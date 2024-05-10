CogStack's custom Streamlit component to display content in a modal.

Use this component in Streamlit apps to show a pop-up that renders above all
other elements on the page.

The implementation is based on [streamlit_modal](https://github.com/teamtv/streamlit_modal)
with some simplifications and fixed CSS.


## Usage

See guidance in [streamlit_modal](https://github.com/teamtv/streamlit_modal).


## Get started

There is no need to install dependencies.

You can add this component to your project by defining a new Git submodule and
cloning the repository containing this component at the root level, inside a
Python package `components`.

```bash
git submodule add https://github.com/uclh-criu/cogstack-streamlit-components components
```

Finally, import the component in your Streamlit app.

```python
# E.g., in <app_root>/pages/1_test_page.py
from components.st_cogstack_modal import Modal
modal = Modal("CogStack Modal", key="cogstack-modal")
```

## Development

To quickly test the component during development, run Streamlit with this
component's `__init__.py` module.

```bash
streamlit run components/st_cogstack_modal/__init__.py
```

Navigate to [localhost:8501](http://localhost:8501). You should see a Streamlit
app running. Edit a component file in `src`, save it, and reload the page to see
your changes.

*Note that there is no need to have [Node.js](https://nodejs.org) installed.
This component uses plain Javascript.*


## Building and running in production

There is no special setup to build this component for production. Follow the
steps above to include it in your Streamlit app and that's it.
