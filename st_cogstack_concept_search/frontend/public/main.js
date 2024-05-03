// The `Streamlit` object exists because our html file includes
// `streamlit-component-lib.js`.
// If you get an error about "Streamlit" not being defined, that
// means you're missing that file.

/*
 * CSS classes used for DOM elements
 */
const CSS_SEARCH_INPUT = "st-cogstack-concept-search-input"       // Main search input
const CSS_RESULT_LIST = "st-cogstack-concept-search-results"      // List of results
const CSS_RESULT_ITEM = "st-cogstack-concept-search-result-item"  // Single result item
const CSS_RESULT_SELECT = "st-cogstack-concept-search-select"     // Hidden select box with result options
const CSS_CHOSEN_ITEM = "st-cogstack-concept-search-chosen"       // Chosen item from the result list



/*
 * Javascript Classes
 */

 /**
  * Model representing a concept in the terminology.
  */
class Concept {
  /**
   * Creates a new Concept representing an item in the concept hierarchy tree.
   *
   * @param {String} code Concept code, unique identifier
   * @param {String} label Human-readable label
   * @param {Concept[]} children List of children concepts, or null of this is a leaf
   * @param {Object} metadata Any additional concept metadata
   * @param {Properties} properties Custom item properties
   */
  constructor(code, label, children, metadata, properties) {
    this.code = code
    this.label = label
    this.children = children
    this.metadata = metadata
    this.properties = properties ?? {}
  }
}

/**
 * Model for additional concept properties.
 *
 * - "style": CSS style used to display the concept.
 * - Other custom properties could be sent from Streamlit.
 */
class Properties {
  /**
   * Concept CSS style attributes.
   *
   * @type CSSStyleDeclaration
   */
  style = {}
}

/**
 * Result of a search returned to Streamlit.
 */
class SearchResult {
  /**
   * Creates a new SearchResult.
   *
   * @param {String} searchText Text searched
   * @param {String[]} searchTerms Terms in the text searched
   * @param {Concept[]} results List of result concepts
   * @param {Concept} selected Concept selected, or null if none selected
   */
  constructor(searchText, searchTerms, results, selected) {
    this.searchText = searchText
    this.searchTerms = searchTerms
    this.results = results.map(c => ({
      "code": c.code,
      "label": c.label,
    }))
    this.selected = {
      "code": selected.code,
      "label": selected.label,
    }
  }
}



/*
 * Component data
 */
const MIN_SEARCH_LEN = 2
const MAX_RESULTS = 10
const KEYS_NAV = ["Up", "ArrowUp", "Down", "ArrowDown", "Enter"]

let _sourceConcepts = []        // List of searchable concepts
let _lastSearchText = null      // Last text searched for
let _lastSearchTerms = null     // List of terms used for the last search
let _lastSelected = null        // Last Concept selected (currently selected)
let _lastResults = null         // Results from the last search
let _currentListItem = null;    // Result option currently highlighted



/*
 * Component config
 */
// ...



/*
 * DOM elements handled by the component
 *
 * (They could also be defined directly in index.html.)
 */
const _searchInput = document.body.appendChild(document.createElement("input"))
_searchInput.type = "search"
_searchInput.placeholder = "Search by code or label"
_searchInput.classList.add("form-control", CSS_SEARCH_INPUT)

const _resultList = document.body.appendChild(document.createElement("ul"))
_resultList.classList.add("list-group", CSS_RESULT_LIST)

const _resultItem = document.createElement("li")
_resultItem.classList.add("list-group-item", CSS_RESULT_ITEM)

// Hidden select box to control selected concept
const _resultSelect = document.body.appendChild(document.createElement("select"))
_resultSelect.classList.add(CSS_RESULT_SELECT)

const _chosenItem = document.body.appendChild(document.createElement("div"))
_chosenItem.classList.add(CSS_CHOSEN_ITEM)
// _chosenItem.textContent = "Selected concept: "

const _chosenLabel = document.createElement("span")
_chosenItem.appendChild(_chosenLabel)


/**
 * Returns the new the Streamlit component's value.
 *
 * The result will contain the list of concepts, the selected `Concept` if any,
 * and other metadata about the search.
 *
 * @returns Dictionary representing the search, results, and selected `Concept`.
 */
function getStreamlitValue() {
  return new SearchResult(_lastSearchText, _lastSearchTerms, _lastResults, _lastSelected)
}

/**
 * Creates an HTML node to represent a `Concept` in the results list.
 *
 * @param {Concept} concept
 * @returns Node representing the result `Concept` as a list item
 */
function createResultItem(concept) {
  const elem = _resultItem.cloneNode()
  elem.textContent = `${concept.code} | ${concept.label}`
  // Custom CSS style
  if (concept.properties && concept.properties.style) {
    for (const k in concept.properties.style) {
      if (elem.style.hasOwnProperty(k)) {
        elem.style[k] = concept.properties.style[k]
      }
    }
  }
  return elem
}

/**
 * Creates an HTML node to represent a `Concept` option in the results select box.
 *
 * @param {Concept} concept
 * @returns Node representing the result `Concept` as an HTML option
 */
function createResultOption(concept) {
  const option = document.createElement("option")
  option.value = concept.code
  option.textContent = `${concept.code} | ${concept.label}`
  return option
}

/**
 * Returnes whether the search text matches a given `Concept`.
 *
 * @param {String} searchText Text to be matched
 * @param {Concept} concept Concept to see if it matches the text
 * @returns True if the concept matches the text, false otherwise.
 */
function matchConcept(searchText, concept) {
  return concept.code.startsWith(searchText) || concept.label.includes(searchText)
}

/**
 * Generator that returns the next Concept matching the search text.
 *
 * Each call to `next()` will return the following concept, starting by the
 * first in the given list. If a concept has children, search continues on them
 * before moving to the next sibling concept.
 *
 * @param {String} searchText Text to be matched with concepts
 * @param {Concept[]} concepts List of concepts where the text is searched
 */
function* findNextResult(searchText, concepts) {
  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i]

    // Search in parent
    if (matchConcept(searchText, concept)) {
      yield concept;
    }

    // Search in children
    if ((concept.children ?? []).length > 0) {
      yield* findNextResult(searchText, concept.children)
    }
  }
  return
}

function selectListItem(newListItem) {
  if (_currentListItem) {
    _currentListItem.classList.remove("active")
  }
  if (newListItem) {
    newListItem.classList.add("active")
  }
  _currentListItem = newListItem
}

function selectNextListItem() {
  if (! _currentListItem) {
    selectListItem(_resultList.firstChild)
  }
  else if (_currentListItem.nextSibling) {
    // Move to the next list item
    selectListItem(_currentListItem.nextSibling)
    // Change select option
    _resultSelect.selectedIndex++
  }
}

function selectPrevListItem() {
  if (_currentListItem && _currentListItem.previousSibling) {
    // Move to the previous list item
    selectListItem(_currentListItem.previousSibling)
    // Change select option
    _resultSelect.selectedIndex--
  }
}

function confirmCurrentItem() {
  if (_currentListItem) {
    _lastSelected = _lastResults[_resultSelect.selectedIndex]
    _chosenLabel.textContent = _currentListItem.textContent

    Streamlit.setFrameHeight()

    // Set component value
    Streamlit.setComponentValue(getStreamlitValue())
  }
}


/*
 * Event handling
 */

// Handle key up event on the search input (update search)
_searchInput.onkeyup = () => {
  // Handle search text change
  if (_lastSearchText == null || _searchInput.value !== _lastSearchText) {
    _lastSearchText = _searchInput.value
    _lastSearchTerms = _lastSearchText.split(" ")
    _lastResults = []

    const resultListItems = []
    const resultOptions = []

    if (_lastSearchText.length >= MIN_SEARCH_LEN) {
      const gen = findNextResult(_lastSearchText, _sourceConcepts)
      let nextResult = gen.next()

      while (!nextResult.done && _lastResults.length < MAX_RESULTS) {
        _lastResults.push(nextResult.value)
        // Create result DOM elements
        resultListItems.push(createResultItem(nextResult.value))
        resultOptions.push(createResultOption(nextResult.value))
        nextResult = gen.next()
      }
    }

    _resultList.replaceChildren(...resultListItems)
    _resultSelect.replaceChildren(...resultOptions)

    // Select first item by default
    selectListItem(_resultList.firstChild)

    Streamlit.setFrameHeight()
  }
}

// Handle key down event on the search input (navigate and choose item)
_searchInput.onkeydown = (event) => {
  if (KEYS_NAV.includes(event.key)) {
    switch (event.key) {
      // Handle navigation between options
      case "Up":
      case "ArrowUp":
        selectPrevListItem()
        break;

      case "Down":
      case "ArrowDown":
        selectNextListItem()
        break;

      // Handle selection of one option
      case "Enter":
        confirmCurrentItem()
    }
  }
}


/**
 * The component's render function. This will be called immediately after
 * the component is initially loaded, and then again every time the
 * component gets new data from Python.
 *
 * @param {Event} event Render event sent by Streamlit
 */
function onRender(event) {
  // We might only want to run the render code the first time the component is
  // loaded.
  if (window.rendered) {
   return
  }
  window.rendered = true;

  // Get the RenderData from the event
  const data = event.detail

  // RenderData.args is the JSON dictionary of arguments sent from the
  // Python script.
  let {concepts} = data.args

  _sourceConcepts = []
  concepts.forEach(c => {
    _sourceConcepts.push(new Concept(c.code, c.label, c.children, c.metadata, c.properties))
  });


  // Maintain compatibility with older versions of Streamlit that don't send
  // a theme object.
  console.debug(data.theme)
  if (data.theme) {
    document.body.classList.add(`theme-${data.theme.base}`)

    // Use CSS vars to style our button border. Alternatively, the theme style
    // is defined in the data.theme object.
    /*
    const borderStyling = `1px solid var(${
      isFocused ? "--primary-color" : "gray"
    })`
    button.style.border = borderStyling
    button.style.outline = borderStyling
    */
  }

  // We tell Streamlit to update our frameHeight after each render event, in
  // case it has changed. (This isn't strictly necessary for the example
  // because our height stays fixed, but this is a low-cost function, so
  // there's no harm in doing it redundantly.)
  Streamlit.setFrameHeight()
}

// Attach our `onRender` handler to Streamlit's render event.
Streamlit.events.addEventListener(Streamlit.RENDER_EVENT, onRender)

// Tell Streamlit we're ready to start receiving data. We won't get our
// first RENDER_EVENT until we call this function.
Streamlit.setComponentReady()

// Finally, tell Streamlit to update our initial height. We omit the
// `height` parameter here to have it default to our scrollHeight.
Streamlit.setFrameHeight()