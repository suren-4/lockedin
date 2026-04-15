import fs from 'fs';
import * as cheerio from 'cheerio';

// Let's create dummy html
function checkCols(html) {
  const $ = cheerio.load(html);
  $('td[bgcolor="#E6E6FA"]').each((_, el) => {
    const cells = $(el).parent().find('td');
    let out = [];
    cells.each((i, c) => out.push($(c).text().trim()));
    console.log(out);
  });
}
