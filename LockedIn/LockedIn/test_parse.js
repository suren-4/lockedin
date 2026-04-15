import * as cheerio from 'cheerio';

const html = `
<table style="font-size :16px;" border="1" align="center" cellpadding="1" cellspacing="1" bgcolor="#FAFAD2">
<tr>
<td bgcolor='#E6E6FA'>1.</td>
<td bgcolor='#E6E6FA'>CS101</td>
<td bgcolor='#E6E6FA'>Computer Science</td>
<td bgcolor='#E6E6FA'>Theory</td>
<td bgcolor='#E6E6FA'>Dr. Smith</td>
<td bgcolor='#E6E6FA'>A</td>
<td bgcolor='#E6E6FA'>24</td>
<td bgcolor='#E6E6FA'>0</td>
<td bgcolor='#E6E6FA'>100.00</td>
<td bgcolor='#E6E6FA'>0</td>
</tr>
</table>
`;
const $ = cheerio.load(html);
$('td[bgcolor="#E6E6FA"]').each((_, el) => {
    const courseCode = $(el).text().trim();
    if(courseCode === 'CS101') {
        const cells = $(el).parent().find('td');
        console.log("length:", cells.length);
        cells.each((i, c) => console.log(i, $(c).text().trim()));
    }
});
