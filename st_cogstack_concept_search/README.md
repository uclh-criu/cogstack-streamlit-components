Cogstack's custom Streamlit component to search for concepts in a hierarchical
terminology dataset.

Use this component in Streamlit apps to display search inputs that allow
navigating a hierarchy of clinical terminology (e.g., ICD-10, SNOMED-CT) and
selecting an item.


## Usage

In Python, display the component and get the selected concept with:
```python
from components.st_cogstack_concept_search import st_cogstack_concept_search
entities = st_cogstack_concept_search([{"code": "Test", "label": "Label"}])
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

You can add this component to your project by defining a new Git submodule and
cloning the repository containing this component at the root level, inside a
Python package `components`.

```bash
git submodule add https://github.com/uclh-criu/cogstack-streamlit-components components
```

Finally, import the component in your Streamlit app.

```python
# E.g., in <app_root>/pages/1_test_page.py
from components.st_cogstack_concept_search import st_cogstack_concept_search
entities = st_cogstack_concept_search([{"code": "Test", "label": "Label"}])
```

## Development

To quickly test the component during development, run Streamlit with this
component's `__init__.py` module.

```bash
streamlit run components/st_cogstack_concept_search/__init__.py
```

Navigate to [localhost:8501](http://localhost:8501). You should see a Streamlit
app running. Edit a component file in `src`, save it, and reload the page to see
your changes.

*Note that there is no need to have [Node.js](https://nodejs.org) installed.
This component uses plain Javascript.*


## Building and running in production

There is no special setup to build this component for production. Follow the
steps above to include it in your Streamlit app and that's it.
