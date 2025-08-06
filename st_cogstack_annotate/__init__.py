import os
from enum import Enum

import streamlit as st
from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs

from components import declare_cogstack_component


class BadgeTooltipField(str, Enum):
    LABEL = "label"
    DETAILS = "details"


parent_dir = os.path.dirname(os.path.abspath(__file__))
build_dir = os.path.join(parent_dir, "frontend/public")
_component_func = declare_cogstack_component(
    "st_cogstack_annotate", path=build_dir)


def st_cogstack_annotate(label, text, entities, label_details=None,
                         badge_field: BadgeTooltipField | None = BadgeTooltipField.LABEL,
                         tooltip_field: BadgeTooltipField | None = BadgeTooltipField.DETAILS,
                         key=None,
                         on_change: WidgetCallback | None = None,
                         on_change_args: WidgetArgs | None = None,
                         on_change_kwargs: WidgetKwargs | None = None,
        ) -> list[dict]:
    """st_cogstack_annotate.

    Parameters
    ----------
    label: str
        Short label used to annotate selected text (e.g. concept code)
    text: str
        Text to render
    entities: object
        Entities found in text
    key: str or None
        An optional key that uniquely identifies this component. If this is
        None, and the component's arguments are changed, the component will
        be re-mounted in the Streamlit frontend and lose its current state.
    label_details: str
        Label with details used to annotate selected text (e.g. concept code and
        label)
    badge_field: str
        (Default "label") Used to determine which field is displayed as a badge
        next to the entity. If None, the badge is hidden.
        Options: None, "label", "details".
    tooltip_field: str
        (Default "details") Used to determine which field is displayed as a
        tooltip when hovering the entity. If None, the tooltip is disabled.
        Options: None, "label", "details".

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
        Entities that have been selected
    """
    component_value = _component_func(
        label=label,
        text=text,
        entities=entities,
        # Component's optional parameters
        label_details=label_details,
        badge_field=badge_field,
        tooltip_field=tooltip_field,
        # Streamlit optional parameters
        key=key,
        default=entities,

        on_change=on_change,
        on_change_args=on_change_args,
        on_change_kwargs=on_change_kwargs,
    )
    return component_value


def main():
    st.write("## Example")
    value = st_cogstack_annotate("Test|Label", "Test text", [])
    st.write(value)


if __name__ == "__main__":
    main()
