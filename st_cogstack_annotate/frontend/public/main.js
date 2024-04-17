// The `Streamlit` object exists because our html file includes
// `streamlit-component-lib.js`.
// If you get an error about "Streamlit" not being defined, that
// means you're missing that file.

/*
 * CSS classes used for DOM elements
 */
const CSS_TEXT = "st-cogstack-annotate-text"              // Main container of the text
const CSS_ENTITY = "st-cogstack-annotate-entity"          // Each annotation entity
const CSS_ENTITY_SELECTED = "selected"                    // Additional class for selected entity
const CSS_ENTITY_REMOVE = "remove"                        // Button to remove entity
const CSS_ENTITY_BADGE = "st-cogstack-annotate-badge"     // Badge to display entity short label
const CSS_ENTITY_TOOLTIP = "st-cogstack-annotate-tooltip" // Tooltip to display entity label details

/*
 * Javascript Classes
 */

 /**
  * Main entity model.
  */
class Entity {
  /**
   * Creates a new Entity representing an annotated text in the source text.
   *
   * @param {Number} start Start index in source text
   * @param {Number} end End index in source text
   * @param {String} label Short label (e.g. concept code)
   * @param {String} details Details about the entity, long label (e.g. concept code and label)
   * @param {String} node DOM Node element
   */
  constructor(start, end, label, details, node, properties) {
    this.start = start
    this.end = end
    this.label = label
    // Details is optional. If null, leave undefined to ignore field when converting entities to Streamlit
    this.details = details ? details : undefined
    this.node = node
    this.properties = properties
  }
}

/**
 * Optional entity properties.
 */
class EntityProperties {
  /**
   * Whether the entity is selected.
   *
   * @type Boolean
   */
  selected = false
}


/*
 * Component data
 */
let _sourceText = ""          // Text to be annotated
let _currentLabel = ""        // Latest label given, used to annotate entities.
let _currentLabelDetails = "" // Latest label details given, used to annotate entities.
let _sourceEntities = null    // Entities existent on startup, not the ones created
                              // in the current session.
let _entities = []            // Entities currently annotated, of type Entity, indexed by label.


/*
 * Component config
 */
let _badgeField = "label"     // Determines which field to display in the badge (see getContentByTheme)
let _tooltipField = "details" // Determines which field to display in the tooltip (see getContentByTheme)



/*
 * DOM elements handled by the component
 *
 * (They could also be defined directly in index.html.)
 */
const _textElem = document.body.appendChild(document.createElement("pre"))
_textElem.classList.add(CSS_TEXT)

const _entityElem = document.createElement("span")
_entityElem.classList.add(CSS_ENTITY)

const _entityElemBadge = document.createElement("span")
_entityElemBadge.classList.add(CSS_ENTITY_BADGE)

const _entityElemTooltip = document.createElement("div")
_entityElemTooltip.classList.add(CSS_ENTITY_TOOLTIP)
_entityElemTooltip.innerHTML = `<div class="inner"></div>`

const _entityElemRemove = document.createElement("button")
_entityElemRemove.classList.add(CSS_ENTITY_REMOVE)
_entityElemRemove.innerHTML = `<svg height="16" width="16" xmlns="http://www.w3.org/2000/svg">
  <circle r="50%" cx="50%" cy="50%"></circle>
  <path d="M5 5 L11 11 M11 5 L5 11"></path>
</svg>`


/*
 * Utility functions
 */

/**
 * Add a selection to the list of annotated entities.
 * Ignores the entity and returns false if the range overlaps existent entities.
 *
 * @param {Number} start    Start index in the source text
 * @param {Number} end      End index in the source text
 * @param {String} label    Label linked to the entity (e.g. concept code)
 * @param {String} details  Details about the label (e.g. concept code and description)
 * @param {EntityProperties} properties Optional entity properties
 * @returns true if the entity was added, false otherwise
 */
function addEntity(start, end, label, details, properties) {
  // Check that new entity does not overlap
  for (let i = 0; i < _entities.length; i++) {
    const e = _entities[i];
    if (e.start <= start && start < e.end || e.start < end && end <= e.end) {
      return false
    }
  }
  _entities.push(new Entity(
    start,
    end,
    label,
    details,
    undefined,  // DOM element yet unknown
    properties,
  ))
  _entities.sort((a, b) => a.start - b.start)
  return true
}

/**
 * Removes an entity based on its positon in the full text.
 *
 * @param {Number} start  Start index in the source text
 * @param {Number} end    End index in the source text
 * @returns true if the entity was found and removed, false otherwise
 */
function removeEntity(start, end) {
  let i = _entities.findIndex(e => e.start === start && e.end === end)
  if (i >= 0) {
    _entities.splice(i, 1)
    return true
  }
  return false
}

/**
 * Sets the Streamlit's component value.
 *
 * Converts the list of `Entity` objects and the dictionary of
 * `EntityProperties` into a serializable value.
 *
 * @returns Pair of values: a list of dictionaries representing the entities and
 * the dictionary of entity properties.
 */
function getStreamlitValue() {
  return _entities.map(e => ({
    start: e.start,
    end: e.end,
    label: e.label,
    details: e.details,
    // Extra properties
    selected: e.properties.selected,
  }))
}

/**
 * Helper to determine the content of badge and tooltip.
 *
 * @param {String} configVar Config variable that determines which field to display
 * @param {String} label Entity short label
 * @param {String} details Entity long label with details
 * @returns Value of "label" or "details", or null if the value of the theme variable is not recognised
 */
function getContentByConfig(configVar, label, details) {
  switch (configVar) {
    case "label":
      return label
    case "details":
      return details
  }
  return null
}

/**
 * Creates an HTML node to represent the annotated entity.
 *
 * @param {Number} start    Start index in the source text
 * @param {Number} end      End index in the source text
 * @param {String} label    Short label, displayed by default as badge next to the text (e.g. concept code)
 * @param {String} details  Long label with details, displayed by default as tooltip text (e.g. concept code and label)
 * @param {EntityProperties} properties Optional entity properties
 * @returns Node representing the entity with its text and label
 */
function createEntityNode(start, end, label, details, properties) {
  const entity = _entityElem.cloneNode()
  entity.textContent = _sourceText.substring(start, end)
  entity.onclick = onEntityClick
  // Entity properties
  if (properties.selected) {
    entity.classList.add(CSS_ENTITY_SELECTED)
  }
  // Badge
  const badge = getContentByConfig(_badgeField, label, details)
  if (badge) {
    const entityBadge = _entityElemBadge.cloneNode()
    entityBadge.textContent = "" + badge
    entity.appendChild(entityBadge)
  }
  // Tooltip
  const tooltip = getContentByConfig(_tooltipField, label, details)
  if (tooltip) {
    const entityTooltip = _entityElemTooltip.cloneNode(true)
    entityTooltip.childNodes[0].textContent = "" + tooltip
    entity.appendChild(entityTooltip)
  }
  // Remove button
  const entityRemove = _entityElemRemove.cloneNode(true)
  entityRemove.onclick = event => {
    removeEntityNode(event)
    const valid = removeEntity(start, end)

    // Send new value to Streamlit
    if (valid) {
      Streamlit.setComponentValue(getStreamlitValue())
    }
  }
  entity.appendChild(entityRemove)
  return entity
}

/**
 * Handles click on an entity.
 *
 * @param {Event} event Click event
 */
function onEntityClick(event) {
  let badge;
  const target = event.target
  if (target.classList.contains(CSS_ENTITY)) {
    badge = target.querySelector(`.${CSS_ENTITY_BADGE}`)
  }
  else if (target.classList.contains(CSS_ENTITY_BADGE)) {
    badge = target
  }
  if (! badge) {
    return
  }
  const label = badge.textContent

  // Update all matching entities
  for (const e of _entities) {
    if (e.label === label) {
      e.properties.selected = ! e.properties.selected
      e.node.classList.toggle(CSS_ENTITY_SELECTED)
    }
  }

  // Set component value
  Streamlit.setComponentValue(getStreamlitValue())
}

/**
 * Handles click on an entity remove button.
 *
 * @param {Event} event Click event
 */
function removeEntityNode(event) {
  const entity = event.target.parentNode
  const entityText = getNodeText(entity)
  // Replace entity by a simple "text" element with its content
  // Prefer appending content to a sibling "text" element
  const previous = entity.previousSibling
  const next = entity.nextSibling
  if (previous && previous.nodeType === Node.TEXT_NODE && next && next.nodeType === Node.TEXT_NODE) {
    // Merge text elements
    previous.textContent += `${entity.textContent}${next.textContent}`
    next.remove()
  }
  else if (previous && previous.nodeType === Node.TEXT_NODE) {
    // Append text to previous sibling
    previous.textContent += `${entityText}`
  }
  else if (next && next.nodeType === Node.TEXT_NODE) {
    // Prepend text to next sibling
    next.textContent = `${entityText}${next.textContent}`
  }
  else {
    // Create new text element
    if (next) {
      entity.parentNode.insertBefore(
        document.createTextNode(entityText), next)
    }
    else {
      entity.parentNode.appendChild(
        document.createTextNode(entityText), next)
    }
  }
  entity.remove();
}

/**
 * Given a node that composes the full text, return the relevant text content.
 * If it's a Text node, the value of "textContent" is returned.
 * Otheriwse, the node must be an entity, so the "textContent" of the first child is returned instead.
 *
 * @param {Node} node Node to get text length from
 * @returns The relevant text inside the node
 */
function getNodeText(node) {
  if (node.nodeType !== Node.TEXT_NODE) {
    return node.childNodes[0].textContent
  }
  return node.textContent
}

/**
 * Renders text highlighting parts of it based on the given entities.
 *
 * @param {String} text     Source text
 * @param {Entity[]} entities  Array of annotated entities in the given text
 * @returns Node with the text as a mix of test nodes and entities with labels
 */
function renderText(text, entities) {
  let buff = document.createElement("div")
  let i = 0
  let substr = ""
  for (const e of entities) {
    // Create previous text node
    substr = text.substring(i, e.start)
    if (substr.length > 0) {
      buff.appendChild(document.createTextNode(substr))
    }
    // Create entity node
    const node = createEntityNode(e.start, e.end, e.label, e.details, e.properties)
    e.node = node
    buff.appendChild(node)
    i = e.end
  }
  // Create last text node
  substr = text.substring(i, text.length)
  if (substr.length > 0) {
    buff.appendChild(document.createTextNode(substr))
  }
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
 *
 * @param {Range} selRange Range of the selection being processed
 * @returns Start and end indexes calculated in the source text
 */
function getRealSelectionRange(selRange) {
  // For the start index: From the range starting child, go back to the
  // beginning and add the length of each intermediate element.
  let start = selRange.startOffset
  let sibling = selRange.startContainer
  while ((sibling = sibling.previousSibling) && sibling !== null) {
    start += getNodeText(sibling).length
  }

  // For the end index: From the range ending child, go back to the start and
  // add the length of each intermediate element.
  let end = selRange.endOffset
  end += start - selRange.startOffset
  if (selRange.startContainer !== selRange.endContainer) {
    let sibling = selRange.endContainer
    while ((sibling = sibling.previousSibling)
           && sibling !== selRange.startContainer) {
      start += getNodeText(sibling).length
    }
  }

  return {start, end}
}


/*
 * Event handling
 */

// Detect mouse text selection
_textElem.onmouseup = () => {
  //console.debug(window.getSelection())
  const selObj = window.getSelection()
  let selText = selObj.toString()

  // Do not allow overlapping selections
  if (selText.trim() === "" || selText.length <= 0 || selObj.anchorNode !== selObj.extentNode) {
    return
  }

  const selRange = selObj.getRangeAt(0)
  //console.debug(selRange)
  let {start, end} = getRealSelectionRange(selRange)
  //console.debug({start, end})

  // Remove spaces at start and end of selection
  start = start + selText.split("").findIndex(c => c.trim() !== "")
  end = end - selText.split("").reverse().findIndex(c => c.trim() !== "")

  // Add new entity from selection
  const valid = addEntity(start, end, _currentLabel, _currentLabelDetails, { selected: false })

  // Update display
  _textElem.replaceChildren(...renderText(_sourceText, _entities).childNodes)

  // Send new value to Streamlit
  if (valid) {
    Streamlit.setComponentValue(getStreamlitValue(_entities))
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
  //if (window.rendered) {
  //  return
  //}
  //window.rendered = true;

  // Get the RenderData from the event
  const data = event.detail

  // RenderData.args is the JSON dictionary of arguments sent from the
  // Python script.
  let {label, text, entities} = data.args
  _sourceText = text
  _currentLabel = label;

  // Add entities from source data
  _entities = []
  entities.forEach(e => addEntity(e.start, e.end, e.label, e.details, { selected: e.selected }))

  // Optional component arguments
  _currentLabelDetails = data.args["label_details"]
  _badgeField = data.args["badge_field"]
  _tooltipField = data.args["tooltip_field"]

  // Display text and highlight annotations
  _textElem.replaceChildren(
    ...renderText(_sourceText, _entities).childNodes)


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
