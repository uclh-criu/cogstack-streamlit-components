import os

import typing

import streamlit as st
from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs

import inspect
import json
import os
from typing import Any, Optional, Type, Union

import streamlit
from streamlit import type_util
from streamlit.elements.form import current_form_id
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Components_pb2 import ArrowTable as ArrowTableProto
from streamlit.proto.Components_pb2 import SpecialArg
from streamlit.proto.Element_pb2 import Element
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import (
    NoValue,
    register_widget,
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
)
from streamlit.runtime.state.common import compute_widget_id
from streamlit.type_util import to_bytes

from streamlit.components.v1.components import (
    ComponentRegistry,
    CustomComponent,
    MarshallComponentException,
)


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

        # Support to declare on_change handlers for custom components
        on_change_handler: Optional[WidgetCallback] = None,
        on_change_args: Optional[WidgetArgs] = None,
        on_change_kwargs: Optional[WidgetKwargs] = None,

        **kwargs,
    ) -> Any:
        """An alias for create_instance."""
        return self.create_instance(*args, default=default, key=key,
                                    on_change_handler=on_change_handler,
                                    on_change_args=on_change_args,
                                    on_change_kwargs=on_change_kwargs,
                                    **kwargs)

    @gather_metrics("create_instance")
    def create_instance(
        self,
        *args,
        default: Any = None,
        key: Optional[str] = None,

        # Support to declare on_change handlers for custom components
        on_change_handler: Optional[WidgetCallback] = None,
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

        on_change_handler: WidgetCallback or None
            (Optional) Callback to be executed after the value for the component
            changes, before the Streamlit script is re-run.
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

        try:
            import pyarrow

            from streamlit.components.v1 import component_arrow
        except ImportError:
            raise StreamlitAPIException(
                """To use Custom Components in Streamlit, you need to install
PyArrow. To do so locally:

`pip install pyarrow`

And if you're using Streamlit Cloud, add "pyarrow" to your requirements.txt."""
            )

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
            elif type_util.is_dataframe_like(arg_val):
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

        def marshall_component(dg, element: Element) -> Union[Any, Type[NoValue]]:
            element.component_instance.component_name = self.name
            element.component_instance.form_id = current_form_id(dg)
            if self.url is not None:
                element.component_instance.url = self.url

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
                id = compute_widget_id(
                    "component_instance",
                    user_key=key,
                    name=self.name,
                    form_id=current_form_id(dg),
                    url=self.url,
                    key=key,
                    json_args=serialized_json_args,
                    special_args=special_args,
                    page=ctx.page_script_hash if ctx else None,
                )
            else:
                id = compute_widget_id(
                    "component_instance",
                    user_key=key,
                    name=self.name,
                    form_id=current_form_id(dg),
                    url=self.url,
                    key=key,
                    page=ctx.page_script_hash if ctx else None,
                )
            element.component_instance.id = id

            def deserialize_component(ui_value, widget_id=""):
                # ui_value is an object from json, an ArrowTable proto, or a bytearray
                return ui_value

            component_state = register_widget(
                element_type="component_instance",
                element_proto=element.component_instance,
                user_key=key,
                widget_func_name=self.name,
                deserializer=deserialize_component,
                serializer=lambda x: x,
                ctx=ctx,

                # Support to declare on_change handlers for custom components
                on_change_handler=on_change_handler,
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

            # widget_value will be either None or whatever the component's most
            # recent setWidgetValue value is. We coerce None -> NoValue,
            # because that's what DeltaGenerator._enqueue expects.
            return widget_value if widget_value is not None else NoValue

        # We currently only support writing to st._main, but this will change
        # when we settle on an improved API in a post-layout world.
        dg = streamlit._main

        element = Element()
        return_value = marshall_component(dg, element)
        result = dg._enqueue(
            "component_instance", element.component_instance, return_value
        )

        return result


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

    # Get our stack frame.
    current_frame = inspect.currentframe()
    assert current_frame is not None

    # Get the stack frame of our calling function.
    caller_frame = current_frame.f_back
    assert caller_frame is not None

    # Get the caller's module name. `__name__` gives us the module's
    # fully-qualified name, which includes its package.
    module = inspect.getmodule(caller_frame)
    assert module is not None
    module_name = module.__name__

    # If the caller was the main module that was executed (that is, if the
    # user executed `python my_component.py`), then this name will be
    # "__main__" instead of the actual package name. In this case, we use
    # the main module's filename, sans `.py` extension, as the component name.
    if module_name == "__main__":
        file_path = inspect.getfile(caller_frame)
        filename = os.path.basename(file_path)
        module_name, _ = os.path.splitext(filename)

    # Build the component name.
    component_name = f"{module_name}.{name}"

    # Create our component object, and register it.
    component = CogstackComponent(name=component_name, path=path, url=url)
    ComponentRegistry.instance().register_component(component)

    return component



class Concept:
    """
    Model representing a concept in the terminology.
    """
    code: str
    label: str
    children: list
    metadata: dict
    properties: dict


class SearchResult:
    """
    Model representing the result of a concept search.
    """
    searchText: str
    searchTerms: str
    results: list
    selected: Concept


parent_dir = os.path.dirname(os.path.abspath(__file__))
build_dir = os.path.join(parent_dir, "frontend/public")
_component_func = declare_cogstack_component(
    "st_cogstack_concept_search", path=build_dir)


def st_cogstack_concept_search(
    concepts: list,
    key=None,
    on_change: typing.Union[WidgetCallback, None] = None,
    on_change_args: typing.Union[WidgetArgs, None] = None,
    on_change_kwargs: typing.Union[WidgetKwargs, None] = None,
) -> dict:
    """st_cogstack_concept_search.

    Parameters
    ----------
    concepts: list[dict]
        Hierarchical list of concepts to use as search database
    key: str or None
        An optional key that uniquely identifies this component. If this is
        None, and the component's arguments are changed, the component will
        be re-mounted in the Streamlit frontend and lose its current state.
    
    on_change: WidgetCallback
        (Optional) Callback to be executed after the value for the component
        changes, before the Streamlit script is re-run.
    on_change_args: WidgetArgs
        (Optional) Positional arguments for the `on_change` callback.
    on_change_kwargs: WidgetKwargs
        (Optional) Keyword arguments for the `on_change` callback.

    Returns
    -------
    object
        (Default None) Search result information including searched text, list
        of concepts found, and selected concept (if any).
    """
    component_value = _component_func(
        concepts=concepts,
        # Component's optional parameters
        # ...
        # Streamlit optional parameters
        key=key,
        default=None,

        on_change_handler=on_change,
        on_change_args=on_change_args,
        on_change_kwargs=on_change_kwargs,
    )
    return component_value


def main():
    st.write("## Example")
    value = st_cogstack_concept_search([
        {
            "code": "A",
            "label": "Label A",
            "children": [
                {
                    "code": "A.1",
                    "label": "Label A1",
                    "children": [
                        {"code": "A.1.1", "label": "Label A11"},
                        {"code": "A.1.2", "label": "Label A12"},
                    ],
                },
                {
                    "code": "A.2",
                    "label": "Label A2",
                    "children": [],
                },
            ],
        },
        {
            "code": "B",
            "label": "Test B",
            "children": [
                {"code": "B.1", "label": "Test B1"},
                {"code": "B.2", "label": "Test B2"},
            ],
        },
    ])
    st.markdown("### Result")
    st.write(value)


if __name__ == "__main__":
    main()
