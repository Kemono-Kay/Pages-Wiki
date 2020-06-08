# Pages-Wiki

A way to create a simple wiki for Github Pages that offers more options that Github's own wiki system.

To use this software (once it's done, which it isn't yet), just drop it into your github pages folder, and edit the contents of the wiki in the "data" folder.

You do not need to keep the license or readme files; they're only here so people know how to use the software, and what they're allowed to do with it (which is anything).

## `config.json`

The following properties exist:

### `title`

A string to use as the wiki's title. This property is required.

### `pages`

An object with page titles as keys and markdown files as values. The first entry in this list is the main page. This property is required. Titles use underscores instead of spaces.

### `nav`

Either an array or a string. As an array, it contains a list of page names. If it's a string, it's a link to a markdown file. This property is optional.

### `footer`

Either an array or a string. As an array, it contains a list of page names. If it's a string, it's a link to a markdown file. This property is optional.

## Markdown

This wiki uses a custom markdown flavour. Markdown syntax is standward, but with a handful of additions.

### Wikilinks

Text wrapped in double square brackets `[[Wiki_Link]]` is parsed as a wikilink. This means that it's not necessary to supply a target to link to; the software will figure out the target and presentation for you.

Wikilinks can also use custom text by setting them as the target of a URL: `[Text]([Wiki_Link])`

### At-Directives

At-directives are like small functions that are used for all sorts of purposes. An at-directive looks like this: `@directive-name`. If you wish to use the @ symbol, you can escape it with a backslash.

#### @category

The @category directive takes an unlimited amount of arguments. Each argument is added to the list of categories this article belongs to. The categories will be inserted at the bottom of the page as links. You can use a single directive for all categories, or use a directive for each category, whichever you like best.

Example: `@category Miscellaneous Example` will create links to the `Category:Miscellaneous` and `Category:Example` pages.

#### @table-of-contents

Will insert the table of contents. Takes no arguments; all necessary data is.

#### @year-range

Will insert a range of years. This is mainly meant to help with copyright notices. Takes two arguments, both years. Can be suffixed with BC/BCE if required. The suffixes AD/CE are not required, but are understood by the directive. The special keyword `now` always refers to the current year.

Leaving out the suffix will lead to the parser assuming AD for the second argument, and the same as the second for the first, but the first date will be assumed to be BC if it becomes larger than the second. If interpreting the first date as BC does not place it before the second date, they will be swapped. In any case, the second date is always bigger.

Examples: 
* `@year-range 200BC 100BC` results in `200 - 100 BC`.
* `@year-range 200 100AD` results in `200 BC - 100 AD`.
* `@year-range 1854 1892` results in `1854 - 1892`.
* `@year-range 1892 1854` results in `1854 - 1892`.