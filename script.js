document.addEventListener("DOMContentLoaded", init);
const list_container = document.getElementById("pokemon-list");
let pokedex_data = null;
let show_gender_diffs = true;

function init() {
  fetch("pokedex.json")
    .then((response) => response.json())
    .then((data) => {
      pokedex_data = data.pokedex.pokemon;
      fetch_pokemon();
    })
    .catch((error) => console.error("Error loading JSON:", error));

  document
    .getElementById("switch-btn")
    .addEventListener("click", fetch_pokemon);
}

// Load the JSON file
function fetch_pokemon() {
  const button = document.getElementById("switch-btn");

  show_gender_diffs = !show_gender_diffs;
  if (show_gender_diffs) {
    button.classList.add("active");
    button.textContent = "Show Pokémon Genders";
  } else {
    button.classList.remove("active");
    button.textContent = "Hide Pokémon Genders";
  }

  clear_list();
  load_list(pokedex_data);
}

function clear_list() {
  list_container.innerHTML = "";
}

function load_list(pokemon_list) {
  pokemon_list
    .flatMap((p) => p.forms)
    .filter((p) => p.has_gender_diference != false || !show_gender_diffs)
    .forEach((pokemon) => {
      const row = document.createElement("div");
      row.className = "pokemon-row";

      const img = document.createElement("img");

      let sprite = "sprites/pokemon/normal/" + pokemon.sprite + ".png";

      img.src = sprite;
      img.alt = pokemon.name;

      const name = document.createElement("span");
      name.textContent = pokemon.name;

      row.appendChild(img);
      row.appendChild(name);

      list_container.appendChild(row);
    });
}
