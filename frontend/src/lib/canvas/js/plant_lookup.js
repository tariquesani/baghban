// PLANT_CATALOG is loaded from js/catalog.js.
const PLANT_DATA = {};
for (const plant of PLANT_CATALOG) {
  const { name, category, ...fields } = plant;
  PLANT_DATA[name] = fields;
}

function escapeOptionText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPlantOptionsHTML(catalog) {
  const groups = [];
  for (const plant of catalog) {
    let group = groups.find(g => g.category === plant.category);
    if (!group) {
      group = { category: plant.category, names: [] };
      groups.push(group);
    }
    group.names.push(plant.name);
  }
  let html = '<option value="">Add plant…</option>';
  for (const group of groups) {
    html += `<optgroup label="${escapeOptionText(group.category)}">`;
    for (const name of group.names) html += `<option>${escapeOptionText(name)}</option>`;
    html += '</optgroup>';
  }
  return html;
}

const PLANT_OPTIONS_HTML = buildPlantOptionsHTML(PLANT_CATALOG);

const plantSelect = document.getElementById('plantSelect');
if (plantSelect) plantSelect.innerHTML = PLANT_OPTIONS_HTML;

// Reverse lookup: emoji character → sqft (used for grid migration)
const EMOJI_SQFT = {};
Object.values(PLANT_DATA).forEach(pd => { EMOJI_SQFT[pd.emoji] = pd.sqft; });
