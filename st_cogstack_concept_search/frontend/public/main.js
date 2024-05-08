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
const CSS_CHOSEN_ITEM = "st-cogstack-concept-search-chosen"       // Chosen item from the result list
const CSS_WITH_METADATA = "st-cogstack-concept-search-with-meta"  // Class for the content wrapper when metadat is shown
const CSS_METADATA = "st-cogstack-concept-search-meta"            // Metadata container next to results
const CSS_METADATA_ITEM = "st-cogstack-concept-search-meta-item"  // Metadata item
const CSS_METADATA_EMPTY = "st-cogstack-concept-search-meta-empty"  // Metadata placeholder item



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
    this.children = children ?? []
    this.metadata = metadata ?? {}
    this.properties = properties ?? {}
  }

  static fromDict(c) {
    let children = undefined
    if (Array.isArray(c.children)) {
      children = c.children.map(Concept.fromDict)
    }
    return new Concept(c.code, c.label, children, c.metadata, c.properties)
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
const KEYS_NAV = ["Up", "ArrowUp", "Down", "ArrowDown", "Enter", "Escape"]

let _sourceConcepts = []        // List of searchable concepts
let _lastSearchText = null      // Last text searched for
let _lastSearchTerms = null     // List of terms used for the last search
let _lastSelected = null        // Last Concept selected (currently selected)
let _lastResults = null         // Results from the last search
let _currentListItem = null     // Result item currently highlighted
let _hoveredListItem = null     // Result item currently hovered (helper to
                                // prevent search input blur event when an item
                                // is clicked)
let _showMetadata = false



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
_searchInput.ariaLabel = "Search by code or label"
_searchInput.classList.add("form-control", CSS_SEARCH_INPUT)

const _resultWrapper = document.body.appendChild(document.createElement("div"))

const _resultList = _resultWrapper.appendChild(document.createElement("ul"))
_resultList.classList.add("list-group", CSS_RESULT_LIST)

const _resultItem = document.createElement("li")
_resultItem.classList.add("list-group-item", CSS_RESULT_ITEM)

// Hidden input to store the index of the selected concept
const _indexHidden = document.body.appendChild(document.createElement("input"))
_indexHidden.type = "hidden"

const _chosenItem = document.body.appendChild(document.createElement("div"))
_chosenItem.classList.add(CSS_CHOSEN_ITEM)
// _chosenItem.textContent = "Selected concept: "

const _chosenLabel = document.createElement("span")
_chosenItem.appendChild(_chosenLabel)

// Metadata to show next to results
const _metadataContainer = document.createElement("div")
_metadataContainer.classList.add(CSS_METADATA)

const _metadataItem = document.createElement("div")
_metadataItem.classList.add(CSS_METADATA_ITEM)
_metadataItem.appendChild(document.createElement("div"))
_metadataItem.appendChild(document.createElement("div"))

const _metadataItemEmpty = document.createElement("div")
_metadataItemEmpty.classList.add(CSS_METADATA_EMPTY)
_metadataItemEmpty.textContent = "No details available"


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
 * @param {Concept} concept Concept item to be displayed
 * @param {Number} index Index of the concept in the result list
 * @returns Node representing the result `Concept` as a list item
 */
function createResultItem(concept, index) {
  const elem = _resultItem.cloneNode()
  elem.textContent = `${concept.code} | ${concept.label}`
  elem.dataset.index = index
  elem.onmouseover = resultItemMouseOver
  elem.onmouseout = resultItemMouseOut
  elem.onclick = resultItemClick
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

function isListHidden() {
  return _resultWrapper.style.display == "none"
}

function showList() {
  _resultWrapper.style.removeProperty("display")
  Streamlit.setFrameHeight()
}

function hideList() {
  _resultWrapper.style.display = "none"
  Streamlit.setFrameHeight()
}

function selectListItem(newListItem) {
  const metadataItems = []
  if (_currentListItem) {
    _currentListItem.classList.remove("active")
    _indexHidden.value = null
  }
  if (newListItem) {
    newListItem.classList.add("active")
    _indexHidden.value = newListItem.dataset.index

    // Collect metadata
    const concept = _lastResults[newListItem.dataset.index]
    for (const key in concept.metadata) {
      const value = concept.metadata[key]
      if (value || value === false) {
        const row = _metadataItem.cloneNode(true)
        row.firstChild.textContent = `${key}:`
        row.lastChild.textContent = value
        metadataItems.push(row)
      }
    }
    if (metadataItems.length === 0) {
      metadataItems.push(_metadataItemEmpty)
    }
  }
  _currentListItem = newListItem
  _metadataContainer.replaceChildren(...metadataItems)
}

function selectNextListItem() {
  if (isListHidden()) {
    showList()
  }
  else if (! _currentListItem) {
    selectListItem(_resultList.firstChild)
  }
  else if (_currentListItem.nextSibling) {
    // Move to the next list item
    selectListItem(_currentListItem.nextSibling)
  }
}

function selectPrevListItem() {
  if (isListHidden()) {
    return
  }
  if (_currentListItem && _currentListItem.previousSibling) {
    // Move to the previous list item
    selectListItem(_currentListItem.previousSibling)
  }
}

function confirmCurrentItem() {
  if (_currentListItem) {
    _lastSelected = _lastResults[_indexHidden.value]
    _chosenLabel.textContent = _currentListItem.textContent

    hideList()

    // Set component value
    Streamlit.setComponentValue(getStreamlitValue())
  }
}


/*
 * Event handling
 */

// Handle key up event on the search input (update search)
_searchInput.oninput = () => {
  // Handle search text change
  if (_lastSearchText == null || _searchInput.value !== _lastSearchText) {
    _lastSearchText = _searchInput.value
    _lastSearchTerms = _lastSearchText.split(" ")
    _lastResults = []
    _indexHidden.value = null

    const resultListItems = []

    if (_lastSearchText.length >= MIN_SEARCH_LEN) {
      const gen = findNextResult(_lastSearchText, _sourceConcepts)
      let nextResult = gen.next()

      while (!nextResult.done && _lastResults.length < MAX_RESULTS) {
        _lastResults.push(nextResult.value)
        // Create result DOM elements
        resultListItems.push(createResultItem(nextResult.value, _lastResults.length - 1))
        nextResult = gen.next()
      }
    }

    _resultList.replaceChildren(...resultListItems)

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
        break

      case "Down":
      case "ArrowDown":
        selectNextListItem()
        break

      // Handle selection of one option
      case "Enter":
        confirmCurrentItem()
        break

      // Close list on "Escape"
      case "Escape":
        hideList()
    }
    event.preventDefault()
  }
}

// Handle mouse click event on the search input (show list)
_searchInput.onclick = () => {
  showList()
}

// Handle focus lost (blur) event on the search input (hide list)
_searchInput.onblur = () => {
  if (_hoveredListItem === null) {
    hideList()
  }
}

/**
 * Handle mouse hover event over result items (select item)
 */
function resultItemMouseOver() {
  selectListItem(this)
  _hoveredListItem = this
}

/**
 * Handle mouse out event for result items (clear hovered item)
 */
function resultItemMouseOut() {
  _hoveredListItem = null
}

/**
 * Handle mouse click event on result items (confirm item)
*/
function resultItemClick() {
  confirmCurrentItem()
  _hoveredListItem = null
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
  let {concepts, show_metadata} = data.args

  // TODO: Do we need to load concepts on every render?
  //_sourceConcepts = concepts
  _sourceConcepts = concepts.map(Concept.fromDict)

  _showMetadata = show_metadata === true
  if (_showMetadata) {
    _resultWrapper.appendChild(_metadataContainer)
    _resultWrapper.classList.add(CSS_WITH_METADATA)
  }


  // Maintain compatibility with older versions of Streamlit that don't send
  // a theme object.
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
