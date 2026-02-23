# items(food ingredients)

## submit item

command: /item_submit

1. user starts submission process with the command /item_submit
2. user either sends a photo or a string, if a barcode then run the barcode scanner on the photo otherwise extract the barcode from the string
3. search the open food facts for that product
4. ask the user for an alias of the item, user can either skip this or send an alias string
5. save the submitted items and its nutrition facts along the alias in db

## list items

command: /item_list [range]

1. user sends a commands with a range query i.e. 5-10, the default is 1-10(the index is 1 based)
2. the items are sent but only the following fields: barcode, name, alias, protein and calories

## delete item

command: /item_delete <barcode or alias>

1. delete the item from the db, alias search first then barcode search

## update item

command: /item_update <alias>

1. user submits an alias
2. if it does not exist an error is shown and flow ends
3. the same flow from "submit item" is executed
