document.addEventListener("DOMContentLoaded", init);

const list_container = document.getElementById("pokedex-list");

let pokedex_data = null;
let hide_gender_diffs = true;
let select_filters = [];

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

function init() {
  fetch("pokedex.json")
    .then((response) => response.json())
    .then((data) => {
      pokedex_data = data.pokedex.pokemon;
      fetch_pokemon();
    })
    .catch((error) => console.error("Error loading JSON:", error));

  // Open and close modal
  const modal = document.getElementById("filter-modal");
  document.getElementById("filter-btn").addEventListener("click", () => {
    modal.style.display = "flex";
  });
  document.getElementById("close-filters-btn").addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target == modal) modal.style.display = "none";
  });

  // Apply filters
  document.querySelectorAll(".filter-option").forEach((element) => {
    element.addEventListener("click", () => {
      select_filters = Array.from(
        document.querySelectorAll("#filter-options input:checked")
      ).map((c) => c.value);

      let hide_all_forms = select_filters.includes("hide_all_forms");
      let hide_genders = select_filters.includes("hide_genders");
      
      document.querySelector("input[value='hide_genders']").disabled = hide_all_forms;
      document.querySelector("input[value='hide_forms_without_gender_differences']").disabled = hide_all_forms || hide_genders;
      document.querySelector("input[value='hide_region_forms']").disabled = hide_all_forms;
      document.querySelector("input[value='hide_mega_forms']").disabled = hide_all_forms;
      document.querySelector("input[value='hide_gigantamax_forms']").disabled = hide_all_forms;

      fetch_pokemon();
    });
  });
}

function fetch_pokemon() {
  list_container.innerHTML = "";

  let hide_all_forms = select_filters.includes("hide_all_forms");
  let hide_forms_without_gender_differences = hide_all_forms || select_filters.includes("hide_forms_without_gender_differences");
  let hide_genders = hide_all_forms || select_filters.includes("hide_genders");
  let hide_region_forms = hide_all_forms || select_filters.includes("hide_region_forms");
  let hide_mega_forms = hide_all_forms || select_filters.includes("hide_mega_forms");
  let hide_gigantamax_forms = hide_all_forms || select_filters.includes("hide_gigantamax_forms");

  let show_shiny_sprites = select_filters.includes("show_shiny_sprites");

  pokedex_data
    .flatMap((p) => p.forms)
    .filter((p) => !hide_all_forms || (hide_all_forms && p.form == null))
    .filter((p) => !hide_genders || (hide_genders && p.gender != "female"))
    .filter((p) => !hide_forms_without_gender_differences || (hide_forms_without_gender_differences && p.has_gender_difference != false))
    .filter((p) => !hide_region_forms || (hide_region_forms && p.region == null))
    .filter((p) => !hide_mega_forms || (hide_mega_forms && p.form != "mega"))
    .filter((p) => !hide_gigantamax_forms || (hide_gigantamax_forms && p.form != "gigantamax"))
    .forEach((pokemon) => {
      const div = document.createElement("div");
      div.className = "pokemon-div";
      div.style = `background: linear-gradient(to right, ${type_colors[pokemon.type1]} 50%, ${type_colors[pokemon.type2 ?? pokemon.type1]} 50%);`

      const img = document.createElement("img");

      let sprite = `sprites/pokemon/${show_shiny_sprites ? "shiny" : "normal"}/${pokemon.sprite}.png`;

      img.src = sprite;
      img.onerror = () => {
        img.src = "assets/0000.png";
      };
      
      const corner_img = document.createElement("img");
      corner_img.className = "corner-img";

      if(pokemon.gender == "male")
        corner_img.src = "assets/male.png";
      else if(pokemon.gender == "female")
        corner_img.src = "assets/female.png";
      
      const name = document.createElement("span");
      name.textContent = pokemon.name;

      div.appendChild(img);
      if (pokemon.gender && !hide_genders && (!hide_forms_without_gender_differences || (hide_forms_without_gender_differences && pokemon.show_gender != false))) {
        div.appendChild(corner_img);
      }
      div.appendChild(name);

      list_container.appendChild(div);
    });
}
