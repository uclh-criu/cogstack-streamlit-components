// The `Streamlit` object exists because our html file includes
// `streamlit-component-lib.js`.
// If you get an error about "Streamlit" not being defined, that
// means you're missing that file.

/*
 * CSS classes used for DOM elements
 */
const CSS_TEXT = "st-cogstack-annotate-text"      // Main container of the text
const CSS_ENTITY = "st-cogstack-annotate-entity"  // Each annotation entity

/*
 * Constants
 */
const ENTITY_FORMAT = `<span class="${CSS_ENTITY}">{{<entity-text>}}</span>`


/*
 * DOM elements handled by the component
 *
 * (They could also be defined directly in index.html.)
 */
const _textElem = document.body.appendChild(document.createElement("div"))
_textElem.classList.add(CSS_TEXT)


/*
 * Component data
 */
let _sourceText = "";     // Text to be annotated
let _currentLabel = "";   // Latest label given, used to annotate entities.
let _origEntities = []    // Entities existent on startup, not the ones created
                          // in the current session.
let _entities = []        // Entities currently annotated. These are tuples of
                          // (start index, end index, selected text, label)


/*
 * Utility functions
 */

/**
 * Add a selection to the list of annotated entities
 */
function addEntity(start, end, selected_text, label) {
  // Check that new entity does not overlap
  for (let i = 0; i < _entities.length; i++) {
    const e = _entities[i];
    if (e.start <= start && start < e.end || e.start < end && end <= e.end) {
      return false
    }
  }
  _entities.push({
    "start": start,
    "end": end,
    "text": selected_text,
    "label": label,
  })
  _entities.sort((a, b) => a.start - b.start)
  console.debug(_entities)
  return true
}


/**
 * Renders text highlighting parts of it based on the given entities.
 **/
function renderText(text, entities, entity_format = ENTITY_FORMAT) {
  let buff = ""
  let i = 0
  for (const e of entities) {
    buff += text.substring(i, e.start)
    buff += entity_format.replace(
      "{{<entity-text>}}",
      text.substring(e.start, e.end),
    )
    i = e.end
  }
  buff += text.substring(i, text.length)
  return buff
}

/**
 * From a given selection Range, return the start and end indexes in the whole
 * parent's text.
 *
 * When the text contains annotations (e.g. after the first selection), the HTML
 * for the whole text becomes a mix of children elements: raw text and spans.
 * The Selection and Range objects returned by window.getSelection() will
 * provide start and end offsets relative to the start and end children.
 *
 * We need to obtain the effective start and end in the entire text by going
 * over all the children, from Range end to start.
 */
function getRealSelectionRange(selRange) {
  // For the start index: From the range starting child, go back to the
  // beginning and add the length of each intermediate element.
  let start = selRange.startOffset
  let sibling = selRange.startContainer
  while ((sibling = sibling.previousSibling) && sibling !== null) {
    start += sibling.textContent.length
  }

  // For the end index: From the range ending child, go back to the start and
  // add the length of each intermediate element.
  let end = selRange.endOffset
  end += start - selRange.startOffset
  if (selRange.startContainer !== selRange.endContainer) {
    let sibling = selRange.endContainer
    while ((sibling = sibling.previousSibling)
           && sibling !== selRange.startContainer) {
      start += sibling.length
    }
  }

  return {start, end}
}


/*
 * Event handling
 */

// Detect mouse text selection
_textElem.onmouseup = (event) => {
  //console.debug(window.getSelection())
  const selObj = window.getSelection()
  const selText = selObj.toString()
  // Do not allow overlapping selections
  if (selText.length <= 0 || selObj.anchorNode !== selObj.extentNode) {
    return
  }
  //selObj.removeAllRanges();

  const selRange = selObj.getRangeAt(0)
  //console.debug(selRange)
  const {start, end} = getRealSelectionRange(selRange)
  //console.debug({start, end})

  // Add selected entity
  const valid = addEntity(start, end, selText, _currentLabel)

  // Update display
  _textElem.innerHTML = renderText(_sourceText, _entities)

  // Send new value to Streamlit
  if (valid) {
    Streamlit.setComponentValue(_entities)
  }
}


/**
 * The component's render function. This will be called immediately after
 * the component is initially loaded, and then again every time the
 * component gets new data from Python.
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
  let {label, text, ents} = data.args
  _sourceText = text
  _currentLabel = label;
  _origEntities = Array.from(ents)
  _entities = Array.from(_origEntities)

  // Display text and highlight annotations
  _textElem.innerHTML = renderText(_sourceText, _origEntities)


  // Maintain compatibility with older versions of Streamlit that don't send
  // a theme object.
  if (data.theme) {
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
