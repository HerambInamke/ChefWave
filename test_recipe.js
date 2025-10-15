
const fs = require('fs');
const path = require('path');

// Function to read and parse a JSON file
function readJsonFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading or parsing JSON file at ${filePath}:`, error);
    return null;
  }
}

// Function to check if recipes are displayed in the HTML
function checkRecipesInHtml(htmlContent, recipes) {
  if (!htmlContent || !recipes || !Array.isArray(recipes)) {
    console.error('Invalid HTML content or recipes data.');
    return;
  }

  let allRecipesFound = true;
  recipes.forEach(recipe => {
    if (htmlContent.includes(recipe.name)) {
      console.log(`SUCCESS: Recipe "${recipe.name}" is displayed in the HTML.`);
    } else {
      console.log(`FAILURE: Recipe "${recipe.name}" is NOT displayed in the HTML.`);
      allRecipesFound = false;
    }
  });

  return allRecipesFound;
}

// Main function to run the test
function main() {
  const recipesFilePath = path.join(__dirname, 'add_recipe.json');
  const htmlFilePath = path.join(__dirname, 'index.html');

  const recipeData = readJsonFile(recipesFilePath);
  if (!recipeData || !recipeData.recipes) {
    console.error('No recipes found in the JSON file.');
    return;
  }

  const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  if (!htmlContent) {
    console.error('Could not read HTML file.');
    return;
  }

  console.log('--- Checking for Recipes in HTML ---');
  const allFound = checkRecipesInHtml(htmlContent, recipeData.recipes);
  console.log('------------------------------------');

  if (allFound) {
    console.log('All recipes from add_recipe.json are correctly displayed in index.html.');
  } else {
    console.log('Some recipes from add_recipe.json are missing from index.html.');
  }
}

main();
