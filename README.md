# Cogstack's collection of Streamlit components

This repository contains several components for the Streamlit framework
developed for Cogstack.

## Usage

### Streamlit version 
The original version only support streamlit version 1.29.0 to 1.33.0 (tagged as v1.33.0)

Please visit https://github.com/uclh-criu/cogstack-streamlit-components/tags for other supported version

### Submodule
This repository can be included in other projects as a submodule. For more
details, see: https://git-scm.com/book/en/v2/Git-Tools-Submodules.

You can clone the repository into a new folder `components` in your project with:
```
git submodule add https://github.com/uclh-criu/cogstack-streamlit-components components
```

Please check out the submodule version v1.33.0
```
git checkout v1.33.0
```

Then, import it as a Python module and use it!
```
from components.st_cogstack_annotate import st_cogstack_annotate

annotations = st_cogstack_annotate("label", "Lorem ispum", {})
```


