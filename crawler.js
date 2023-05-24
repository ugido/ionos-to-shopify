

require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const jsonfile = require('jsonfile');
var _ = require('lodash');


async function getElementText(page, selector){

    const textSelector = await page.waitForSelector(selector, {visible: true});
    const text = await textSelector?.evaluate(el => el.textContent);

    return text;
}


async function processPage(page, url){

    await page.goto(productPage, {
        waitUntil: 'networkidle2'
    });

    const pageTitle = await page.title();
    const productTitle = await getElementText(page, 'h1');
    console.log(productTitle);

    
    //await sleep(3000);
    
}

async function getProducts(page){

    const rootSelector = '.productlist';
    const productSelector = '.product-container';

    const root = await page.waitForSelector(rootSelector);

    const linkElement = await page.waitForSelector(productSelector);

    const products = await page.evaluate(
        () => {
            var productUrls = Array.from(
                document.querySelectorAll('.productlist .product-container a.product-url'),
                a => ({
                  url: a.getAttribute('href'),
                  text: a.textContent.trim()
                })
            );

            var prices = Array.from(
                document.querySelectorAll('.productlist .product-container .current-price-container'),
                span => ({
                  text: span.textContent.trim()
                })
            );

            var productItems = Array.from(document.querySelectorAll('.productlist .product-container'));

            var items = productItems.map(item => {

                var link = item.querySelector('a.product-url');
                var oldPriceElement = item.querySelector('.productOldPrice');
                var oldPrice = oldPriceElement ? oldPriceElement.textContent.trim() : '';
                var price = item.querySelector('.current-price-container').textContent.trim();
                price = price.replace(oldPrice, '');

                return {
                    title: link.textContent.trim(),
                    url: link.getAttribute('href'),
                    price: price,
                    oldPrice: oldPrice
                }
            });

            return items;
        }
      );

    return products;
}


async function getProduct(page, productUrl){

    await page.goto(productUrl, {
        waitUntil: 'networkidle2'
    });

    const product = await page.evaluate(
        () => {
            var title = document.querySelector('h1').innerText;

            var images = Array.from(document.querySelectorAll('#image-collection-container img.img-responsive'), 
            image => image.src
            );
            var modelNumber = document.querySelector('.model-number-text').innerText.trim();
            var variations = []; 

            return {
                title: title,
                modelNumber: modelNumber,
                images: images,
                variations: variations,
            }
        });

    return product;
}


async function processCategoryPage(page, categoryUrl){

    /*
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--start-maximized',
        ],
        defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.goto(categoryUrl, {
        waitUntil: 'networkidle2'
    });
    */

    await page.goto(categoryUrl, {
        waitUntil: 'networkidle2'
    });

    var products = await getProducts(page);
    console.log(products);    
    return products;

    /*
    const pageTitle = await page.title();
    const productTitle = await getElementText(page, 'h1');
    console.log(productTitle);
    */

    //await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


(async () => {
    
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--start-maximized',
        ],
        defaultViewport: null,
    });

    const page = await browser.newPage();

    var productUrl = process.env.GAMBIO_EXAMPLE_URL;
    var product = await getProduct(page, productUrl);
    console.log('product: ', product);

    /*
    var categoryUrl = process.env.GAMBIO_EXAMPLE_CATEGORY;
    var productDetails = await processCategoryPage(page, categoryUrl);

    var results = [];

    for(var i=0; i<productDetails.length; i++){
        let productDetail = productDetails[i];
        if(i === 3) break;
        let url = productDetail.url;
        var product = await getProduct(page, url);
        results.push(product);
        await sleep(2000);
    }

    console.log('results: ', results);
    */

    await browser.close();
    //.productlist: .current-price-container, a.product-url
    //var selector = '.productlist .current-price-container';
    //await processPage();
    

})();