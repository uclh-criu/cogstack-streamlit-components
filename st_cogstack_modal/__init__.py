from contextlib import contextmanager

import streamlit as st
import streamlit.components.v1 as components
from streamlit.delta_generator import DeltaGenerator

from streamlit import rerun


class Modal:

    def __init__(
            self, title: str, key: str, padding: int | str = 20,
            max_width: int | str = 744
    ) -> None:
        """
        :param title: title of the Modal shown in the h1
        :param key: unique key identifying this modal instance
        :param padding: padding of the content within the modal
        :param max_width: maximum width this modal should use
        """
        self.title = title
        self.padding = f"{padding}px" if isinstance(padding, int) else padding
        self.max_width = \
            f"{max_width}px" if isinstance(max_width, int) else max_width
        self.key = key

    def is_open(self) -> bool:
        return st.session_state.get(f"{self.key}-opened", False)

    def open(self) -> None:
        st.session_state[f"{self.key}-opened"] = True
        rerun()

    def close(self, rerun_condition: bool = True) -> None:
        st.session_state[f"{self.key}-opened"] = False
        if rerun_condition:
            rerun()

    @contextmanager
    def container(self) -> DeltaGenerator:
        st.markdown(
            f"""
            <style>
            .st-modal {{
                position: fixed; 
                width: 100vw !important;
                left: 0;
                z-index: 999999;
            }}

            .st-modal::before {{
                position: fixed;
                content: ' ';
                left: 0;
                right: 0;
                top: 0;
                bottom: 0;
                z-index: 0;
                background-color: rgba(50, 50, 50, 0.8);
            }}

            .st-modal > div:first-child {{
                margin: auto;
                max-width: {self.max_width};
            }}

            .st-modal > div:first-child > div:first-child {{
                width: unset !important;
                background-color: #FFFFFF; /* Will be overridden if possible */
                padding: {self.padding};
                border-radius: 5px;
                
                overflow-y: auto;
                max-height: 80vh;
                overflow-x: hidden;
                max-width: {self.max_width};
            }}
            
            /* Modal header */
            .st-modal > div > div > div > div > div > div:first-child {{
                padding-bottom: {self.padding};
                border-bottom: 1px solid rgba(250, 250, 250, 0.2);
            }}
            
            /* Modal close button */
            .st-modal > div > div > div > div > div > div:first-child > div:nth-child(2) button {{
                float: right;
                min-width: 38.4px;
            }}
            
            .st-modal > div > div > div > div > div > div > div:nth-child(2) button p {{
                font-size: .5rem;
                font-weight: bold;
            }}
            
            .st-modal .title {{
                padding: 0;
                font-size: 2rem;
            }}
            
            .st-modal .title a {{
                display: none;
            }}
            
            .st-modal .separator {{
                margin: 1em 0;
            }}
            </style>
            """,
            unsafe_allow_html=True,
        )
        with st.container():
            _container = st.container()

            title, close_btn = _container.columns([0.9, 0.1])
            if self.title:
                with title:
                    st.markdown(
                        f'<h2 class="title">{self.title}</h2>',
                        unsafe_allow_html=True)
            with close_btn:
                closed = st.button("╳", key=f"{self.key}-close")
                if closed:
                    self.close()

        components.html(
            f"""
            <script>
            // ST-COGSTACK-MODAL-IFRAME-{self.key} <- Don't remove this comment. It's used to find our iframe
            const iframes = parent.document.body.getElementsByTagName('iframe');
            let container
            for (const iframe of iframes) {{
                if (iframe.srcdoc.indexOf("ST-COGSTACK-MODAL-IFRAME-{self.key}") >= 0) {{
                    container = iframe.parentNode.previousSibling;
                    container.classList.add('st-modal');
                    container.dataset.modalKey = '{self.key}';
                    console.debug(container);
                    
                    // Copy background color from body
                    const contentDiv = container.querySelector('div:first-child > div:first-child');
                    contentDiv.style.backgroundColor = getComputedStyle(parent.document.body).backgroundColor;
                }}
            }}
            </script>
            """,
            height=0, width=0,
        )

        with _container:
            yield _container


def main() -> None:
    st.write("## Example")
    modal = Modal("CogStack Modal", key="cogstack-modal")
    open_modal = st.button("⛶ &nbsp;Open modal")
    if open_modal:
        modal.open()
    if modal.is_open():
        with modal.container():
            st.write("Insert text and then return to the main page")
            value = st.text_input("Username", placeholder="Insert value")
            if value:
                st.write(f"Hello {value}")

            return_value = st.button("Return value", disabled=(not value))
            if return_value:
                st.session_state["cogstack-modal-value"] = value
                modal.close()

    modal_value = st.session_state.get("cogstack-modal-value")
    if modal_value:
        st.write(f"Value from modal: {modal_value}")


if __name__ == "__main__":
    main()
