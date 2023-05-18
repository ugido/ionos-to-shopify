

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

    const token = process.env.ECWID_API_TOKEN;
    const api_base_url = process.env.ECWID_API_BASE_URL;
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

    const token = process.env.ECWID_API_TOKEN;
    const api_base_url = process.env.ECWID_API_BASE_URL;
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

        await processEntityPart(entity, offset+100);
    }
}


async function saveEntityPart(entity, offset, data){
    jsonfile.writeFileSync(`data/${entity}.${offset}.json`, data);
}



//console.dir(jsonfile.readFileSync(file))

var shopifyInstance = axios.create({
    baseURL: process.env.SHOPIFY_API_URL,
    timeout: 20000,
    headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_API_TOKEN
    },
    validateStatus: function (status) {
        return status >= 200 && status < 500; // default
    },
});

async function getShopifyProduct(id = null){

    if(id){
        var response = await shopifyInstance.get(`products/${id}.json`);
        if(response.status != 200){
            console.error('ERROR: getProduct response.status= ', response.status);
            return 0;
        }

        var product = response.data.product;
        console.log('getShopifyProduct: response.status: ', response.status);
        console.log('getShopifyProduct: product: ', id, product);
    }
    else {
        var response = await shopifyInstance.get('products.json');
        var products = response.data.products;
        console.log('getShopifyProduct: response.status: ', response.status);
        console.log('getShopifyProduct: first product in products request: ', products.length, products[0]);
    }
}


async function setShopifyProductVariant(id, quantity){

    //arguments: product_id/ variant_id, variantProps

        var response = await shopifyInstance.get(`products/${id}.json`);
        if(response.status != 200){
            console.error('ERROR: setShopifyProductVariant: productFetching: response.status= ', response.status);
            return 0;
        }

        //console.log('getShopifyProduct: response.status: ', response.status);
        //console.log('getShopifyProduct: product: ', id, product);

        var product = response.data.product;
        var variant = product.variants[0];
        console.log('variant.id: ', variant.id);

        var updateResponse = await shopifyInstance.put(`/variants/${variant.id}.json`, {
            variant: {
                id: variant.id,
                price: '10.10',
                //inventory_quantity: quantity
            }
        });

        if(updateResponse.status != 200){
            console.error('ERROR: setShopifyProductVariant variantUpdate updateResponse.status= ', updateResponse.status);
            return 0;
        }

        variant = updateResponse.data.variant;
        
        console.log('setShopifyProductVariant variant: ', variant);
}


async function getFirstLocationId(){
    var localtionsResponse = await shopifyInstance.get(`locations.json`);
    if(localtionsResponse.status != 200){
        console.error('ERROR: setShopifyProductInventory: productFetching: status= ', localtionsResponse.status);
        return null;
    }

    var locations = localtionsResponse.data.locations;
    //console.log('locations: ', locations);

    var first_location_id = locations[0].id;
    return first_location_id;
}

async function setInventoryManagementValue(variant_id, inventory_management){
    //return 1;
    var updateVariantResponse = await shopifyInstance.put(`/variants/${variant_id}.json`, {
        variant: {
            id: variant_id,
            inventory_management: inventory_management,
            //inventory_policy: 'deny', //default: deny. 'continue', 'deny' -> when out of stock, continue selling or deny?
            //price: '10.10',
            //inventory_quantity: quantity
        }
    });

    if(updateVariantResponse.status != 200){
        console.error('ERROR: setShopifyProductVariant variantUpdate updateVariantResponse.status= ', updateVariantResponse.status);
        return 0;
    }

    var variant = updateVariantResponse.data.variant;
    
    console.log('setShopifyProductVariant inventory_management to for variant_id: ', variant.inventory_management, variant.id);
    return 1;
}


async function setShopifyProductInventory(location_id, product_id, quantity){

    var response = await shopifyInstance.get(`products/${product_id}.json`);
    if(response.status != 200){
        console.error('ERROR: setShopifyProductInventory: productFetching: product_id, status= ', product_id, response.status);
        return 0;
    }

    //console.log('getShopifyProduct: response.status: ', response.status);
    var product = response.data.product;
    var variant = product.variants[0];
    var inventory_item_id = variant.inventory_item_id;
    // console.log('getShopifyProduct: product: ', id, product);
    console.log('variant.id, inventory_item_id: ', variant.id, inventory_item_id);
    //return 1;

    var inventory_management = null;
    /**/
    if(quantity){
        inventory_management = 'shopify';
        var valueUpdated = await setInventoryManagementValue(variant.id, inventory_management);
        if(!valueUpdated){
            console.error('ERROR: setShopifyProductInventory: setInventoryManagementValue: product_id, status= ', product_id, response.status);
            return 0;
        }

        var inventoryLevelUpdateResponse = await shopifyInstance.post(`/inventory_levels/set.json`, {
            location_id: location_id,
            inventory_item_id: inventory_item_id,
            available: quantity,
        });
    
        if(inventoryLevelUpdateResponse.status != 200){
            console.error('ERROR: setShopifyProductVariant inventoryLevelUpdateResponse status= ', inventoryLevelUpdateResponse.status, inventoryLevelUpdateResponse.data);
            return 0;
        }
    
        var inventory_level = inventoryLevelUpdateResponse.data.inventory_level;
        
        var newQuantity = inventory_level.available;
        console.log('setShopifyProductInventory: updated variant quantity to ', newQuantity);
        //console.log('setShopifyProductVariant inventory_level: ', inventory_level);
    }
    else {
        //set variant inventory_management = null

        var result = await setInventoryManagementValue(variant.id, inventory_management);
    }
    
    /*
    var inventoryLevelResponse = await shopifyInstance.get(`/inventory_levels.json`, {
        params: {
            inventory_item_ids: inventory_item_id
        }
    });
    if(inventoryLevelResponse.status != 200){
        console.error('ERROR: setShopifyProductInventory: inventoryLevelResponse: status= ', inventoryLevelResponse.status);
        return 0;
    }

    var inventory_levels = inventoryLevelResponse.data.inventory_levels;
    console.log('inventory_levels: ', inventory_levels);
    return 1;    
    */


    /*
    var inventoryResponse = await shopifyInstance.get(`/inventory_items/${inventory_item_id}.json`);
    if(inventoryResponse.status != 200){
        console.error('ERROR: setShopifyProductInventory: inventoryResponse: status= ', inventoryResponse.status);
        return 0;
    }

    var inventory_item = inventoryResponse.data.inventory_item;
    console.log('inventory_item: ', inventory_item);
    return 1;    
    */

    /*
    var updateResponse = await shopifyInstance.put(`/inventory_item/${inventory_item_id}.json`, {
        inventory_item: {
            id: inventory_item_id,
            tracked: false,
            //price: '10.10',
            //inventory_quantity: quantity
        }
    });

    if(updateResponse.status != 200){
        console.error('ERROR: setShopifyProductInventory updateResponse status= ', updateResponse.status, updateResponse.data);
        return 0;
    }

    var inventory_item = updateResponse.data.inventory_item;
    
    console.log('setShopifyProductInventory updateResponse inventory_item: ', inventory_item);
    */
}


(async () => {
    
    var product_id = 8388265476415;
    var quantity = 2;

    var location_id = await getFirstLocationId();
    //return 0;
    await setShopifyProductInventory(location_id, product_id, quantity);
    //await getShopifyProduct(id);
    

    //await processEntity('categories');
    //await processEntity('products');
    //await processCategories();
    //await processPage();

})();
