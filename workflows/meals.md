# Meals

## Create meal

command: /meal_create <name>
name is gonna be either in quotes or will have no whitespaces if no quotes are there

1. user starts with giving a name, reject duplicate names(case-insensitive).
2. user adds ingredients(items) one by one along with their values, it will be the combination of <barcode or alias> <amount>
   with id having priority. amount is positive float and based on the items unit of the item for example milk is going to be ml and cheese
   is going to be grams. this can be done either in one message with each line representing one entry or multiple
   messages, treat each line in a message as one entry. if an entered item is invalid(missing id for example) tell the
   user but keep everything else. use current state of the items in the database. if an item is entered multiple times use the latest. 
3. user sends the case-insensitive message "done" and saves the meal. 
4. the aggregate nutrition values of the meal(protein, calories) are shown to the user

