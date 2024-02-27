import os

import streamlit as st
import streamlit.components.v1 as components

parent_dir = os.path.dirname(os.path.abspath(__file__))
build_dir = os.path.join(parent_dir, "frontend/public")
_component_func = components.declare_component(
    "st_cogstack_annotate", path=build_dir)


def st_cogstack_annotate(label, text, ents, key=None) -> list[dict]:
    """st_cogstack_annotate.

    Parameters
    ----------
    text: str
        Text to render
    ents: object
        Entities found in text
    key: str or None
        An optional key that uniquely identifies this component. If this is
        None, and the component's arguments are changed, the component will
        be re-mounted in the Streamlit frontend and lose its current state.

    Returns
    -------
    object
        Entities that have been selected
    """
    component_value = _component_func(
        label=label,
        text=text,
        ents=ents,
        key=key,
        default=ents,
    )
    return component_value


def main():
    st.write("## Example")
    value = st_cogstack_annotate("Test|Label", "Test text", [])
    st.write(value)


if __name__ == "__main__":
    main()
