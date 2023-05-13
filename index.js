
/**/


require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');


//import puppeteer from 'puppeteer';
//console.log(process.env.SHOP_URL);
//SAMPLE_PRODUCT_URL


async function getElementText(page, selector){

    const textSelector = await page.waitForSelector(selector, {visible: true});

    const text = await textSelector?.evaluate(el => el.textContent);

    return text;
}


async function getBreadCrumbs(page){

    const rootSelector = '.ec-breadcrumbs';
    const breadcrumbsLinkSelector = '.breadcrumbs__link';

    const root = await page.waitForSelector(rootSelector);

    const linkElement = await page.waitForSelector(breadcrumbsLinkSelector);

    const links = await page.evaluate(
        () => Array.from(
          document.querySelectorAll('.product-details__sidebar .ec-breadcrumbs a.breadcrumbs__link'),
          a => ({
            url: a.getAttribute('href'),
            text: a.textContent
          })
        )
      );

    return links;
}


async function getItemPropContent(page, itemprop){
    const selector = `[itemprop=${itemprop}]`;
    const textSelector = await page.waitForSelector(selector);
    const content = await textSelector?.evaluate(el => el.getAttribute('content'));
    return content;
}

(async () => {

    const productPage = process.env.SAMPLE_PRODUCT_URL

    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
  
    await page.goto(productPage);
  
    // Set screen size
    await page.setViewport({width: 1080, height: 1024});
  
    const pageTitle = await page.title()
    const productTitle = await getElementText(page, 'h1');

    console.log(productTitle);

    const breadcrumbs = await getBreadCrumbs(page);
    console.log(breadcrumbs);
    
    const price = await getItemPropContent(page, 'price');
    console.log(price);

    const detailsHeader = await getElementText(page, '.product-details__product-options .product-details-module__title');
    console.log(detailsHeader);

    const optionRadioSelector = '.product-details__product-options .product-details-module__content .form-control__radio';

    //option



    /*
    const selector = 'h1';
    const textSelector = await page.waitForSelector(selector, {visible: true});

    const text = await textSelector?.evaluate(el => el.textContent);

    console.log(text);
    */
    /*
    // Type into search box
    await page.type('.search-box__input', 'automate beyond recorder');
  
    // Wait and click on first result
    const searchResultSelector = '.search-box__link';
    await page.waitForSelector(searchResultSelector);
    await page.click(searchResultSelector);
  
    // Locate the full title with a unique string
    const textSelector = await page.waitForSelector(
      'text/Customize and automate'
    );
    const fullTitle = await textSelector?.evaluate(el => el.textContent);
  
    // Print the full title
    console.log('The title of this blog post is "%s".', fullTitle);
        
    */
    await browser.close();
  })();
