document.addEventListener("DOMContentLoaded", init);

const list_container = document.getElementById("pokedex-list");
const filter_modal = document.getElementById("filter-modal");
const pokemon_modal = document.getElementById("pokemon-modal");

const folder_name = "the_pokedex"
const file_name = "the_pokedex_data.json"

let pokedex_data = null;
let hide_gender_diffs = true;
let select_filters = [];
let pokemon = {}

// Google API variables
let tokenClient;
let accessToken = null;
let tokenExpiry = null;

const type_colors = {
  Normal: "#A8A77ABE",
  Fire: "#EE8130BE",
  Water: "#6390F0BE",
  Electric: "#F7D02CBE",
  Grass: "#7AC74CBE",
  Ice: "#96D9D6BE",
  Fighting: "#C22E28BE",
  Poison: "#A33EA1BE",
  Ground: "#E2BF65BE",
  Flying: "#A98FF3BE",
  Psychic: "#F95587BE",
  Bug: "#A6B91ABE",
  Rock: "#B6A136BE",
  Ghost: "#735797BE",
  Dragon: "#6F35FCBE",
  Dark: "#705746BE",
  Steel: "#B7B7CEBE",
  Fairy: "#D685ADBE"
};

function init() {  // Wait for Google API to load
  if (typeof google === 'undefined') {
    setTimeout(init, 100);
    return;
  }

  // Initialize Google Identity Services
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('tokenExpiry', tokenExpiry);
        updateSigninStatus(true);
        // No need to load Drive API separately
        readFromDrive();
      }
    },
  });

  // Check for stored token
  const storedToken = localStorage.getItem('accessToken');
  const storedExpiry = localStorage.getItem('tokenExpiry');
  if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
    accessToken = storedToken;
    tokenExpiry = parseInt(storedExpiry);
    updateSigninStatus(true);
    // No need to load Drive API
    readFromDrive();
  } else {
    // Clear expired token
    localStorage.removeItem('accessToken');
    localStorage.removeItem('tokenExpiry');
    updateSigninStatus(false);
  }

  fetch("pokedex.json")
    .then((response) => response.json())
    .then((data) => {
      pokedex_data = data.pokedex.pokemon.flatMap((p) => p.forms);
      //fetch_pokemon();
    })
    .catch((error) => console.error("Error loading JSON:", error));

  // Open and close filter modal
  document.getElementById("filter-btn").addEventListener("click", () => {
    filter_modal.style.display = "flex";
  });
  document.getElementById("filter-modal-close-btn").addEventListener("click", () => {
    filter_modal.style.display = "none";
    saveToDrive();
  });

  window.addEventListener("click", (e) => {
    if (e.target == filter_modal) filter_modal.style.display = "none";
    if (e.target == pokemon_modal) pokemon_modal.style.display = "none";
  });

  // Apply filters
  document.querySelectorAll(".filter-modal-option").forEach((element) => {
    element.addEventListener("click", () => {
      apply_filters();
    });
  });
}

function fetch_pokemon() {
  console.log("fetch_pokemon");
  
  list_container.innerHTML = "";

  let hide_all_forms = select_filters.includes("hide_all_forms");
  let hide_forms_without_gender_differences = hide_all_forms || select_filters.includes("hide_forms_without_gender_differences");
  let hide_genders = hide_all_forms || select_filters.includes("hide_genders");
  let hide_region_forms = hide_all_forms || select_filters.includes("hide_region_forms");
  let hide_mega_forms = hide_all_forms || select_filters.includes("hide_mega_forms");
  let hide_gigantamax_forms = hide_all_forms || select_filters.includes("hide_gigantamax_forms");

  let show_shiny_sprites = select_filters.includes("show_shiny_sprites");

  pokedex_data
    .filter((p) => !hide_all_forms || (hide_all_forms && p.form == null))
    .filter((p) => !hide_genders || (hide_genders && p.gender != "female"))
    .filter((p) => !hide_forms_without_gender_differences || (hide_forms_without_gender_differences && p.has_gender_difference != false))
    .filter((p) => !hide_region_forms || (hide_region_forms && p.region == null))
    .filter((p) => !hide_mega_forms || (hide_mega_forms && p.form != "mega"))
    .filter((p) => !hide_gigantamax_forms || (hide_gigantamax_forms && p.form != "gigantamax"))
    .forEach((pokemon) => {
      const div = document.createElement("div");
      div.id = pokemon.id;
      div.className = "pokemon-div";
      div.style = `background: linear-gradient(to right, ${type_colors[pokemon.type1]} 50%, ${type_colors[pokemon.type2 ?? pokemon.type1]} 50%);`;
      
      div.addEventListener("click", () => {
        pokemon_modal.style.display = "flex";

        let pokemon_modal_content = pokemon_modal.querySelector("#pokemon-modal-content");
        pokemon_modal_content.innerHTML = "";

        // Pokemon Modal Close
        const modal_close = document.createElement("span");
        modal_close.id = "pokemon-modal-close-btn";
        modal_close.className = "close";
        modal_close.innerHTML = "&times;";
        modal_close.addEventListener("click", () => {
          pokemon_modal.style.display = "none";
        });

        // Pokemon Modal Image
        const modal_image = document.createElement("img");
        modal_image.className = "pokemon-img";

        set_pokemon_image(modal_image, pokemon, show_shiny_sprites);

        // Pokemon Modal Name
        const modal_name = document.createElement("h2");
        modal_name.className = "pokemon-text";
        modal_name.textContent = pokemon.name;

        // Pokemon Modal Types
        const modal_types_div = document.createElement("div");
        modal_types_div.className = "pokemon-types-div";
        
        const type1_tag = document.createElement("span");
        type1_tag.className = "type-badge";
        type1_tag.textContent = (pokemon.type1 ?? "").toUpperCase();
        type1_tag.style = `background-color: ${type_colors[pokemon.type1]};`

        const type2_tag = document.createElement("span");
        type2_tag.className = "type-badge";
        type2_tag.textContent = (pokemon.type2 ?? "").toUpperCase();
        type2_tag.style = `background-color: ${type_colors[pokemon.type2]};`
        
        // Pokemon Modal Appends
        if(pokemon.type1) modal_types_div.appendChild(type1_tag);
        if(pokemon.type2) modal_types_div.appendChild(type2_tag);

        pokemon_modal_content.appendChild(modal_close);
        pokemon_modal_content.appendChild(modal_name);
        pokemon_modal_content.appendChild(modal_types_div);
        pokemon_modal_content.appendChild(modal_image);
      });

      // Pokemon Image
      const img = document.createElement("img");
      img.className = "pokemon-img";

      set_pokemon_image(img, pokemon, show_shiny_sprites);

      // Pokemon Gender
      const corner_img = document.createElement("img");
      corner_img.className = "corner-img";

      if(pokemon.gender == "male")
        corner_img.src = "assets/male.png";
      else if(pokemon.gender == "female")
        corner_img.src = "assets/female.png";

      // Pokemon Number
      const corner_text = document.createElement("span");
      corner_text.className = "corner-text";
      corner_text.textContent = "#" + pokemon.id.substring(0, 4);
      
      // Pokemon Name
      const name = document.createElement("span");
      name.className = "pokemon-text";
      name.textContent = pokemon.name;

      // Pokemon Div Appends
      div.appendChild(corner_text);
      div.appendChild(img);
      if (pokemon.gender && !hide_genders && (!hide_forms_without_gender_differences || (hide_forms_without_gender_differences && pokemon.show_gender != false))) {
        div.appendChild(corner_img);
      }
      div.appendChild(name);

      list_container.appendChild(div);
    });
    
  // Hide loading
  document.getElementById("loading-pokedex-list").style.display = "none";
}

function set_pokemon_image(img, pokemon, show_shiny_sprites) {
  let sprite = `sprites/pokemon/${show_shiny_sprites ? "shiny" : "normal"}/${pokemon.sprite}.png`;

  img.src = sprite;
  img.onerror = () => {
    img.src = "assets/0000.png";
  };
}

function apply_filters(){
  console.log("apply_filters");
  
  select_filters = Array.from(
    document.querySelectorAll("#filter-modal-options input:checked")
  ).map((c) => c.value);

  let hide_all_forms = select_filters.includes("hide_all_forms");
  let hide_genders = select_filters.includes("hide_genders");
  
  document.querySelector("input[value='hide_genders']").disabled = hide_all_forms;
  document.querySelector("input[value='hide_forms_without_gender_differences']").disabled = hide_all_forms || hide_genders;
  document.querySelector("input[value='hide_region_forms']").disabled = hide_all_forms;
  document.querySelector("input[value='hide_mega_forms']").disabled = hide_all_forms;
  document.querySelector("input[value='hide_gigantamax_forms']").disabled = hide_all_forms;

  fetch_pokemon();
}

function handleCredentialResponse(response) {
  console.log("Encoded JWT ID token: " + response.credential);
}

function updateSigninStatus(isSignedIn) {
  const controls = document.querySelector('.controls');
  const driveControls = document.querySelector('.drive-controls');
  const loading_pokedex_list = document.querySelector('#loading-pokedex-list');
  if (isSignedIn) {
    document.getElementById('signin-button').innerHTML = '<button onclick="signOut()">Sign Out</button>';
    controls.style.display = 'flex';
    driveControls.style.display = 'flex';
    loading_pokedex_list.style.display = '';
  } else {
    document.getElementById('signin-button').innerHTML = '<button onclick="signIn()">Sign In with Google</button>';
    controls.style.display = 'none';
    driveControls.style.display = 'none';
    loading_pokedex_list.style.display = 'none';
  }
}

function signIn() {
  if (!tokenClient) {
    alert('Google API not loaded yet. Please wait and try again.');
    return;
  }
  tokenClient.requestAccessToken();
}

function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('access token revoked');
      accessToken = null;
      tokenExpiry = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tokenExpiry');
      updateSigninStatus(false);
      // Clear the Pokemon list
      list_container.innerHTML = "";
    });
  }
}

// Function to get or create the folder
async function getOrCreatePokedexFolder() {
  if (!accessToken) return null;

  // Search for existing folder
  const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name%3D%27${folder_name}%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id,name)`, {
    method: 'GET',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
  });
  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  } else {
    // Create the folder
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: new Headers({ 
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({
        name: folder_name,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    const createData = await createResponse.json();
    return createData.id;
  }
}

// Example function to save data to Google Drive
async function saveToDrive() {
  if (!accessToken) {
    alert('Please sign in first');
    return;
  }

  let content = {
    version: "1.0.0",
    message: 'Hello from Pokedex!',
    timestamp: new Date().toISOString(),
    filters: select_filters
  }

  try {
    const folder_id = await getOrCreatePokedexFolder();
    if (!folder_id) {
      alert('Failed to create or find folder');
      return;
    }

    // Check if file already exists
    const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name%3D'${file_name}'%20and%20'${folder_id}'%20in%20parents%20and%20trashed%3Dfalse&fields=files(id,name)`, {
      method: 'GET',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    });
    const searchData = await searchResponse.json();

    const file_content = typeof content === 'string' ? content : JSON.stringify(content);
    const file = new Blob([file_content], {type: 'application/json'});

    if (searchData.files && searchData.files.length > 0) {
      // Update existing file
      const file_id = searchData.files[0].id;
      const updateResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file_id}?uploadType=media`, {
        method: 'PATCH',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: file,
      });
      if (updateResponse.ok) {
        console.log(`Google Drive File updated.`);
      } else {
        console.log('Failed to update file');
      }
    } else {
      // Create new file
      const metadata = {
        name: file_name,
        mimeType: 'application/json',
        parents: [folder_id],
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
      form.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
      });
      const val = await response.json();
      console.log(val);
      console.log(`File saved to Drive in "${folder_name}" folder`);
    }
  } catch (error) {
    console.error('Error saving to Drive:', error);
    console.log('Error saving file');
  }
}

// Example function to read from Google Drive
async function readFromDrive() {
  if (!accessToken) {
    alert('Please sign in first');
    return;
  }

  try {
    const folderId = await getOrCreatePokedexFolder();
    if (!folderId) {
      console.log('Failed to find or create folder in user\'s Google Drive');
      return;
    }

    // Search for the file in the folder
    const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name%3D'${file_name}'%20and%20'${folderId}'%20in%20parents%20and%20trashed%3Dfalse&fields=files(id,name)`, {
      method: 'GET',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    });
    const searchData = await searchResponse.json();

    if (searchData.files && searchData.files.length > 0) {
      const fileId = searchData.files[0].id;
      // Read the file
      const readResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        method: 'GET',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      });
      const content = await readResponse.text();
      console.log(content);
      
      // Parse the JSON and restore filters
      const data = JSON.parse(content);
      if (data.filters && Array.isArray(data.filters)) {
        select_filters = data.filters;
        
        // Update checkbox states to match loaded filters
        document.querySelectorAll(".filter-modal-option").forEach((checkbox) => {
          checkbox.checked = select_filters.includes(checkbox.value);
        });

        // Apply the filters
        apply_filters();
        //fetch_pokemon();
      }
    } else {
      console.log(`File "${file_name}" not found in "${folder_name}" folder`);
    }
  } catch (error) {
    console.error('Error reading file from Drive:', error);
  }
}