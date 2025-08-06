import inspect
import json
from pathlib import Path
from types import FrameType
from typing import Any, Optional, Final

from streamlit import type_util, dataframe_util, config
from streamlit.components.v1.component_registry import _get_module_name
from streamlit.components.v1.components import (
    CustomComponent,
    MarshallComponentException,
)
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.form import current_form_id
from streamlit.elements.lib.policies import check_cache_replay_rules
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.proto.Components_pb2 import ArrowTable as ArrowTableProto
from streamlit.proto.Components_pb2 import SpecialArg
from streamlit.proto.Element_pb2 import Element
from streamlit.runtime import get_instance
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs, )
from streamlit.type_util import to_bytes

_LOGGER: Final = get_logger(__name__)


class CogstackComponent(CustomComponent):
    """
    Cogstack custom component extending Streamlit's CustomComponent.

    Provides support to handle the component's on change event, missing in the
    base class.
    """

    def __call__(
        self,
        *args,
        default: Any = None,
        key: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        tab_index: int | None = None,
        # Support to declare on_change handlers for custom components
        #on_change_handler: Optional[WidgetCallback] = None,
        on_change_args: Optional[WidgetArgs] = None,
        on_change_kwargs: Optional[WidgetKwargs] = None,

        **kwargs,
    ) -> Any:
        """An alias for create_instance."""
        return self.create_instance(*args, default=default, key=key,
                                    on_change=on_change,
                                    tab_index=tab_index,
                                    on_change_args=on_change_args,
                                    on_change_kwargs=on_change_kwargs,
                                    **kwargs)

    @gather_metrics("create_instance")
    def create_instance(
        self,
        *args,
        default: Any = None,
        key: Optional[str] = None,
        on_change: Optional[WidgetCallback] = None,
        tab_index: int | None = None,
        # Support to declare on_change handlers for custom components
        on_change_args: Optional[WidgetArgs] = None,
        on_change_kwargs: Optional[WidgetKwargs] = None,

        **kwargs,
    ) -> Any:
        """
        Create a new instance of the component.

        Parameters
        ----------
        *args
            Must be empty; all args must be named. (This parameter exists to
            enforce correct use of the function.)
        default: any or None
            The default return value for the component. This is returned when
            the component's frontend hasn't yet specified a value with
            `setComponentValue`.
        key: str or None
            If not None, this is the user key we use to generate the
            component's "widget ID".
        on_change: WidgetCallback or None
            An optional callback invoked when the widget's value changes. No arguments are passed to it.
        tab_index : int, optional
            Specifies the tab order of the iframe containing the component.
            Possible values are:
            - ``None`` (default): Browser default behavior.
            - ``-1``: Removes the iframe from the natural tab order, but it can still be focused programmatically.
            - ``0`` or positive integer: Includes the iframe in the natural tab order.
        on_change_args: WidgetArgs or None
            (Optional) Positional arguments for the `on_change_handler`
            callback.
        on_change_kwargs: WidgetKwargs or None
            (Optional) Keyword arguments for the `on_change_handler`
            callback.

        **kwargs
            Keyword args to pass to the component.

        Returns
        -------
        any or None
            The component's widget value.

        """
        if len(args) > 0:
            raise MarshallComponentException(f"Argument '{args[0]}' needs a label")

        # Validate tab_index according to web specifications
        if tab_index is not None and not (
                isinstance(tab_index, int)
                and not isinstance(tab_index, bool)
                and tab_index >= -1
        ):
            raise StreamlitAPIException(
                "tab_index must be None, -1, or a non-negative integer."
            )

        try:
            import pyarrow   # noqa: F401, ICN001

            from streamlit.components.v1 import component_arrow
        except ImportError:
            raise StreamlitAPIException(
                """To use Custom Components in Streamlit, you need to install
PyArrow. To do so locally:

`pip install pyarrow`

And if you're using Streamlit Cloud, add "pyarrow" to your requirements.txt."""
            )

        check_cache_replay_rules()
        # In addition to the custom kwargs passed to the component, we also
        # send the special 'default' and 'key' params to the component
        # frontend.
        all_args = dict(kwargs, **{"default": default, "key": key})

        json_args = {}
        special_args = []
        for arg_name, arg_val in all_args.items():
            if type_util.is_bytes_like(arg_val):
                bytes_arg = SpecialArg()
                bytes_arg.key = arg_name
                bytes_arg.bytes = to_bytes(arg_val)
                special_args.append(bytes_arg)
            elif dataframe_util.is_dataframe_like(arg_val):
                dataframe_arg = SpecialArg()
                dataframe_arg.key = arg_name
                component_arrow.marshall(dataframe_arg.arrow_dataframe.data, arg_val)
                special_args.append(dataframe_arg)
            else:
                json_args[arg_name] = arg_val

        try:
            serialized_json_args = json.dumps(json_args)
        except Exception as ex:
            raise MarshallComponentException(
                "Could not convert component args to JSON", ex
            )

        def marshall_component(dg, element: Element) -> Any:
            element.component_instance.component_name = self.name
            element.component_instance.form_id = current_form_id(dg)
            if self.url is not None:
                element.component_instance.url = self.url
            if tab_index is not None:
                element.component_instance.tab_index = tab_index

            # Normally, a widget's element_hash (which determines
            # its identity across multiple runs of an app) is computed
            # by hashing its arguments. This means that, if any of the arguments
            # to the widget are changed, Streamlit considers it a new widget
            # instance and it loses its previous state.
            #
            # However! If a *component* has a `key` argument, then the
            # component's hash identity is determined by entirely by
            # `component_name + url + key`. This means that, when `key`
            # exists, the component will maintain its identity even when its
            # other arguments change, and the component's iframe won't be
            # remounted on the frontend.

            def marshall_element_args():
                element.component_instance.json_args = serialized_json_args
                element.component_instance.special_args.extend(special_args)

            ctx = get_script_run_ctx()

            if key is None:
                marshall_element_args()
                computed_id = compute_and_register_element_id(
                    "component_instance",
                    user_key=key,
                    form_id=current_form_id(dg),
                    name=self.name,
                    url=self.url,
                    json_args=serialized_json_args,
                    special_args=special_args,
                )
            else:
                computed_id = compute_and_register_element_id(
                    "component_instance",
                    user_key=key,
                    form_id=current_form_id(dg),
                    name=self.name,
                    url=self.url,
                )
            element.component_instance.id = computed_id

            def deserialize_component(ui_value: Any) -> Any:
                # ui_value is an object from json, an ArrowTable proto, or a bytearray
                return ui_value

            component_state = register_widget(
                element.component_instance.id,
                deserializer=deserialize_component,
                serializer=lambda x: x,
                ctx=ctx,
                on_change_handler=on_change,
                value_type="json_value",
                # Support to declare on_change handlers for custom components
                args=on_change_args,
                kwargs=on_change_kwargs,
            )
            widget_value = component_state.value

            if key is not None:
                marshall_element_args()

            if widget_value is None:
                widget_value = default
            elif isinstance(widget_value, ArrowTableProto):
                widget_value = component_arrow.arrow_proto_to_dataframe(widget_value)
            return widget_value

        # We currently only support writing to st._main, but this will change
        # when we settle on an improved API in a post-layout world.
        dg = get_dg_singleton_instance().main_dg

        element = Element()
        return_value = marshall_component(dg, element)

        dg._enqueue("component_instance", element.component_instance)
        return return_value


def declare_cogstack_component(
    name: str,
    path: Optional[str] = None,
    url: Optional[str] = None,
) -> CogstackComponent:
    """
    Create and register a custom CogstackComponent.

    Parameters
    ----------
    name: str
        A short, descriptive name for the component. Like, "slider".
    path: str or None
        The path to serve the component's frontend files from. Either
        `path` or `url` must be specified, but not both.
    url: str or None
        The URL that the component is served from. Either `path` or `url`
        must be specified, but not both.

    Returns
    -------
    CogstackComponent
        A CogstackComponent, extending CustomComponent, that can be called like
        a function.
        Calling the component will create a new instance of the component
        in the Streamlit app.

    """
    if path is not None and isinstance(path, Path):
        path = str(path)

    # Get our stack frame.
    current_frame: FrameType | None = inspect.currentframe()
    if current_frame is None:
        raise RuntimeError("current_frame is None. This should never happen.")
    # Get the stack frame of our calling function.
    caller_frame = current_frame.f_back
    if caller_frame is None:
        raise RuntimeError("caller_frame is None. This should never happen.")

    module_name = _get_module_name(caller_frame)

    # Build the component name.
    component_name = f"{module_name}.{name}"

    # Create our component object, and register it.
    component = CustomComponent(
        name=component_name, path=path, url=url, module_name=module_name
    )
    # the ctx can be None if a custom component script is run outside of Streamlit, e.g. via 'python ...'
    ctx = get_script_run_ctx()
    if ctx is not None:
        get_instance().component_registry.register_component(component)
    return component
