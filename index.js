

require('dotenv').config();
//const puppeteer = require('puppeteer');
const axios = require('axios');

//import {writeJsonFile} from 'write-json-file';
const jsonfile = require('jsonfile');


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


async function getRadioElementData(page){
    const optionRadioSelector = '.product-details__product-options .product-details-module__content .form-control__radio';

    const radios = await page.evaluate(
        (optionRadioSelector) => Array.from(
          document.querySelectorAll(optionRadioSelector),
          input => ({
            id: input.id,
            value: input.value,
            name: input.getAttribute('name'),
            checked: input.checked
          })
        ),
        optionRadioSelector
      );

    return radios;
}


async function getVariantPrices(page){

    const optionRadioSelector = '.product-details__product-options .product-details-module__content .form-control__radio';

    const radioElements = await page.$$(optionRadioSelector);

    var variantPrices = [];

    var lastSku = await getItemPropContent(page, 'sku');

    for (const radioElement of radioElements) {
        
        await radioElement.click();
        await sleep(1000);

        await page.waitForFunction(element => element.checked === true, {}, radioElement);

        await sleep(1000);

        let currentPrice = await getProductPrice(page);
        let value = await radioElement.evaluate(element => element.value);
        let name = await radioElement.evaluate(element => element.getAttribute('name'));
        let checked = await radioElement.evaluate(element => element.checked);

        variantPrices.push({
            price: currentPrice,
            value: value,
            name: name,
            checked: checked
        });
    }

    return variantPrices;
}


async function getProductPrice(page){
    const price = await getItemPropContent(page, 'price');
    return price;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function closeCookieModal(page){

    const acceptTrackingButtonJsPath = `document.querySelector("#usercentrics-root").shadowRoot.querySelector("[data-testid='uc-accept-all-button']")`;
    const acceptTrackingButton = await page.evaluateHandle(acceptTrackingButtonJsPath);//await ( .asElement();
    
    await acceptTrackingButton.click();
    await sleep(1000);
    const acceptCookiesButton = await page.waitForSelector('button ::-p-text(Alle Cookies akzeptieren)', {visible: true});
    await acceptCookiesButton.click();
}


async function getProductImages(page){
    var images = [];



    return images;
}

async function processPage(){

    const productPage = process.env.SAMPLE_PRODUCT_URL;

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--start-maximized',
        ],
        defaultViewport: null,
    });//{headless: 'new'}

    const page = await browser.newPage();
    await page.goto(productPage, {
        waitUntil: 'networkidle2'
    });

    //await sleep(3000);

    // Set screen size
    //await page.setViewport({width: 1080, height: 1024});

    await closeCookieModal(page);
    //await sleep(4000);
    console.log('accepted tracking and all cookies :-)');

    const pageTitle = await page.title();
    const productTitle = await getElementText(page, 'h1');
    console.log(productTitle);

    const breadcrumbs = await getBreadCrumbs(page);
    console.log(breadcrumbs);
    
    const price = await getItemPropContent(page, 'price');
    console.log(price);

    const price2 = await getElementText(page, '.product-details__product-price .details-product-price__value');
    console.log(price2);

    const detailsHeader = await getElementText(page, '.product-details__product-options .product-details-module__title');
    console.log(detailsHeader);

    const radioElementData = await getRadioElementData(page);
    console.log('radioData: ', radioElementData);

    const priceDetails = await getVariantPrices(page);
    console.log('priceDetails: ', priceDetails);

    const productImages = await getProductImages(page);
    console.log('productImages: ', productImages);

    await browser.close();
}


async function processCategories(){

    const token = process.env.TOKEN;
    const api_base_url = process.env.API_BASE_URL;
    const url = api_base_url+'categories';//+'?token='+token;

    let offset = 100;

    //console.log(url);return;

    var response = await axios.get(url, {
        params: {
            token: token,
            offset: offset,
        }
        //'key': process.env.ELVENFAN_KEY,
    });

    var data = response.data;



    console.log(data.count);
}


async function processEntity(entity){

    await processEntityPart(entity, 0);
}

async function processEntityPart(entity, offset){

    const token = process.env.TOKEN;
    const api_base_url = process.env.API_BASE_URL;
    const url = api_base_url+entity;

    var response = await axios.get(url, {
        params: {
            token: token,
            offset: offset,
        }
    });

    var data = response.data;

    if(data.count > 0){
        await saveEntityPart(entity, offset, data);
        await sleep(1000);

        //await processEntityEntries(entity, data);

        await processEntityPart(entity, offset+100);
    }
}


async function saveEntityPart(entity, offset, data){
    jsonfile.writeFileSync(`data/${entity}.${offset}.json`, data);
}


async function processEntityEntries(entity, data){
    
    const items = data.items;

    for(var i=0; i<items.length; i++){



    }
}

//console.dir(jsonfile.readFileSync(file))


(async () => {
    
    await processEntity('categories');
    await processEntity('products');
    //await processCategories();
    //await processPage();

})();
