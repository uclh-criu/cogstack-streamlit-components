Cogstack's custom Streamlit component to annotate text.

Use this component in Streamlit apps to show text and annotate it based on a
given label.


## Usage

In Python, display the component and get the list of annotated entities with:
```python
from components import st_cogstack_annotate
entities = st_cogstack_annotate("Label", "Test text", [])
```


## Template

This component is based on the **very minimal** template mentioned in this blog:
https://blog.streamlit.io/how-to-build-your-own-streamlit-component/

The boilerplate is available in this repository:
https://github.com/blackary/cookiecutter-streamlit-component/

The component uses plain Javascript and depends on the Streamlit Javascript
component `frontend/public/streamlit-component-lib.js`, which is likely to be
outdated since it was generated in September 2022.

More sophisticated components, using npm and TypeScript, can be built following
the official component templates available at:
https://github.com/streamlit/component-template.


## Get started

There is no need to install dependencies.

Download this component and store it along your Streamlit app, e.g. inside a
Python package `components`.

Then, update `components/__init__.py` and import it. This will make it easier to
use later in your app.

```python
# <app_root>/components/__init__.py
import st_cogstack_annotate
```

Finally, import the component in your Streamlit app.

```python
# E.g., in <app_root>/pages/1_test_page.py
from components import st_cogstack_annotate
entities = st_cogstack_annotate("Label", "Test text", [])
```

## Development

To quickly test the component during development, run Streamlit with this
component's `__init__.py` module.

```bash
streamlit run components/st_cogstack_annotate/__init__.py
```

Navigate to [localhost:8501](http://localhost:8501). You should see a Streamlit
app running. Edit a component file in `src`, save it, and reload the page to see
your changes.

*Note that there is no need to have [Node.js](https://nodejs.org) installed.
This component uses plain Javascript.*


## Building and running in production

There is no special setup to build this component for production. Follow the
steps above to include it in your Streamlit app and that's it.
