import os
import typing

import streamlit as st
from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs

from components import declare_cogstack_component


class SearchConcept:
    """
    Model representing a concept in the terminology.
    """
    code: str
    label: str
    children: list
    metadata: dict
    properties: dict

    def __init__(
            self, code: str, label: str, children: list = None,
            metadata: dict = None, properties: dict = None,
    ):
        self.code = code
        self.label = label
        self.children = children
        self.metadata = metadata
        self.properties = properties


class SearchResult:
    """
    Model representing the result of a concept search.
    """
    search_text: str
    search_terms: list[str]
    results: list
    selected: SearchConcept

    def __init__(
            self, searchText: str, searchTerms: list[str], results: list[dict],
            selected: dict = None,
    ):
        self.search_text = searchText
        self.search_terms = searchTerms
        self.results = [SearchConcept(**c) for c in results]
        self.selected = SearchConcept(**selected) if selected else None


parent_dir = os.path.dirname(os.path.abspath(__file__))
build_dir = os.path.join(parent_dir, "frontend/public")
_component_func = declare_cogstack_component(
    "st_cogstack_concept_search", path=build_dir)


def st_cogstack_concept_search(
    concepts: list[dict],
    key=None,
    on_change: typing.Union[WidgetCallback, None] = None,
    on_change_args: typing.Union[WidgetArgs, None] = None,
    on_change_kwargs: typing.Union[WidgetKwargs, None] = None,
) -> SearchResult:
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
    component_value: dict = _component_func(
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
    return SearchResult(**component_value) if component_value else None


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
