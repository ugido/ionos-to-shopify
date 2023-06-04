

require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const jsonfile = require('jsonfile');
var _ = require('lodash');
var md5 = require('md5');

var gambioInstance = axios.create({
    baseURL: process.env.GAMBIO_SHOP_URL,//+'/'+shop.php,
    timeout: 20000,
    headers: {
        //'X-Shopify-Access-Token': process.env.SHOPIFY_API_TOKEN
    },
    validateStatus: function (status) {
        return status >= 200 && status < 500; // default
    },
});

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

async function saveEntityPart(entity, offset, data){
    jsonfile.writeFileSync(`data/gambio/${entity}.${offset}.json`, data);
}


async function getElementText(page, selector){

    const elementSelector = await page.waitForSelector(selector, {visible: true});
    const text = await elementSelector?.evaluate(el => el.textContent);

    return text.trim();
}


async function getInputValue(page, selector){
    return await getInputAttribute(page, selector, 'value');
}


async function getInputAttribute(page, selector, attribute){
    const inputSelector = await page.waitForSelector(selector); //, {visible: true}
    const value = await page.evaluate((input, attribute) => input[attribute], inputSelector, attribute);
    return value;
}


async function getSelectorCount(page, selector){

    let elements = await page.$$(selector);
    let count = elements.length;
    return count;
}


async function getSelectData(page, selector){
    const textSelector = await page.waitForSelector(selector, {visible: true});

    const options = await textSelector?.evaluate(el => {
        var items = Array.from(
            el.options,
            option => ({
              value: option.value,
              label: option.textContent.trim()
            })
        );

        return items;
    });

    return options;
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

    const pageTitle = await getElementText(page, 'h1');

    if(pageTitle === 'Erweiterte Suche'){
        return [];
    }

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


async function hideCookieElement(page){

    let cookieElement = await page.waitForSelector('#usercentrics-root');
    await page.evaluate(() => { document.querySelector('#usercentrics-root').style.display = 'none'; });
}

async function getProduct(page, productUrl){

    await page.goto(productUrl, {
        waitUntil: 'networkidle2'
    });

    await hideCookieElement(page);
    await sleep(1000);

    let modifierGroupCount = await getSelectorCount(page, '.modifiers-selection .modifier-group');
    //console.log('modifierGroupCount: ', modifierGroupCount);
    //let modifierGroups = await page.waitForSelector();

    let variations = [];
    let modifierLabel = null;
    let selectItems = null;

    if(modifierGroupCount > 0){
        modifierLabel = await getElementText(page, '.modifiers-selection .modifier-group .modifier-label');
        selectItems = await getSelectData(page, '.modifiers-selection .modifier-group .modifier-content select');
        //console.log(modifierLabel, selectItems);

        let galleryHash = await getInputValue(page, '#current-gallery-hash');
        let product_id = await getInputValue(page, '#products-id');
        let selectName = await getInputAttribute(page, '.modifiers-selection .modifier-group .modifier-content select', 'name');

        //console.log('galleryHash: ', galleryHash);
        let requestParameters = {
            do: 'CheckStatus',
            galleryHash: galleryHash,
            products_id: product_id,
            products_qty: 1,
            'btn-add-to-cart': 'In den Warenkorb',
            target: 'check',
            isProductInfo: 1,
            page_token: '',
            '_': '1',
        };

        
        for(const selectItem of selectItems ){
            //console.log(selectItem.value);
            //await sleep(1000);

            let selectValue = selectItem.value;
            if(selectValue === '0') continue;

            requestParameters[selectName] = selectValue;

            let responseData = await gambioInstance.get('shop.php', {
                params: requestParameters
            });

            if(responseData.status != 200){
                console.error('ERROR: getGambioShopData: status= ', responseData.status);
                return 0;
            }
            else {
                if(responseData.data.success){
                    //console.log('responseData.data.status_code: ', responseData.data.status_code);
                    let content = responseData.data.content;

                    variations.push({
                        price: content.price.value,
                        model: content.model.value,
                        option1: selectItem.label,
                    });
                }
                else {
                    console.error('ERROR: getGambioShopData: success false for ', productUrl);
                    return false;
                }
                //variations.push(responseData.data);
            }

            
            //console.log('requestParameters: ', requestParameters);
        }

        //requestParameters[selectName] = selectValue;
        
    }


    const product = await page.evaluate(
        () => {

            var title = document.querySelector('h1').innerText;

            var images = Array.from(document.querySelectorAll('#image-collection-container img.img-responsive'), 
                image => image.src
            );

            var description = document.querySelector('.product-info-description .tab-body.active').innerHTML;

            var modelNumber = document.querySelector('.model-number-text')?  document.querySelector('.model-number-text').innerText.trim() : null;

            var oldPriceElement = document.querySelector('.price-container .productOldPrice');
            var oldPrice = oldPriceElement ? oldPriceElement.textContent.trim() : '';
            var price = document.querySelector('.price-container .current-price-container').textContent.trim();
            price = price.replace(oldPrice, '');
            
            var variations = []; 
            
            return {
                title: title,
                modelNumber: modelNumber,
                images: images,
                variations: variations,
                description: description,
                price: price,
                oldPrice: oldPrice,
            }
        }
    );

    product.variations = variations;
    product.modifierGroupCount = modifierGroupCount;
    product.modifierLabel = modifierLabel;
    product.selectItems = selectItems;
    product.schemaData = null;
    product.url = productUrl;
    
    const schemaElements = await page.$$('script[type="application/ld+json"]');
    if(schemaElements.length > 0){
        const breadcrumbsText = await page.evaluate(element => element.innerText, schemaElements[0]);
        product.breadcrumbs = JSON.parse(breadcrumbsText);
    }

    if(schemaElements.length > 1){
        const schemaText = await page.evaluate(element => element.innerText, schemaElements[1]);
        product.schemaData = JSON.parse(schemaText);
    }

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

    let urlSuffix = '?view_mode=tiled&listing_sort=&listing_count=192';

    await page.goto(categoryUrl+urlSuffix, {
        waitUntil: 'networkidle2'
    });

    var images = await page.evaluate(el => {
        var images = Array.from(
            document.querySelectorAll('.categories-images img'),
            image => ({
              src: image.src,
              title: image.title
            })
        );

        return images;
    });
    
    var description = await page.evaluate(el => {
        var text = Array.from(
            document.querySelectorAll('.categories-description-container'),
            container => ({
              hasText: container.innerText.trim() != '',
              length: container.innerText.trim().length,
              html: container.innerHTML,
            })
        )
        .filter(item => item.hasText)
        .map(item => item.html.trim())
        .join();

        return text;
    });

    var products = await getProducts(page);
     
    return {
        products: products,
        images: images,
        description: description,
    };

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


async function processCategories(page){

    let url = process.env.GAMBIO_SHOP_URL;

    await page.goto(url, {
        waitUntil: 'networkidle2'
    });

    const mainCategories = await page.evaluate(
        () => {
            var mainLevelLinks = Array.from(
                document.querySelectorAll('li.level-1-child>a'),
                a => {
                    var parent = a.parentElement;
                    var subLinks = Array.from(
                        parent.querySelectorAll('li.level-2-child>a'),
                        a => {
                           return {
                          url: a.getAttribute('href'),
                          text: a.textContent.trim()
                        }
                        }
                    );

                   return {
                    url: a.getAttribute('href'),
                    text: a.textContent.trim(),
                    subLinks: subLinks,
                    }
                }
            );

            return mainLevelLinks;
            }
    );

    return mainCategories;
}


async function processCategoryProducts(page, categories){

    var categoryData = []; 

    for(var mainCategoryIndex = 0; mainCategoryIndex < categories.length; mainCategoryIndex++){
        var mainCategory = categories[mainCategoryIndex];

        var categoryItem = await processCategoryPage(page, mainCategory.url);

        var subLinks = mainCategory.subLinks;

        categoryData.push({
            label: mainCategory.text,
            url: mainCategory.url,
            //product_count: categoryItem.products.length,
            products: subLinks.length > 0 ? [] : categoryItem.products,
            images: categoryItem.images,
            description: categoryItem.description,
        });

        if(subLinks.length > 0){
            console.log('main category: ', mainCategory.text);
            for(var subCategoryIndex = 0; subCategoryIndex < subLinks.length; subCategoryIndex++){
                var subCategory = subLinks[subCategoryIndex];
                //console.log('sub category: ', subCategory.text);
                var categoryItem = await processCategoryPage(page, subCategory.url)
                
                categoryData.push({
                    label: subCategory.text,
                    url: subCategory.url,
                    //product_count: categoryItem.products.length,
                    products: categoryItem.products,
                    images: categoryItem.images,
                    description: categoryItem.description,
                });

                await sleep(1000);
            }


        }
        else {
            
            //console.log('Main category: ', mainCategory.text);
        }

        
        //categoryData.push(categoryItem);
    }

    /*
    await page.goto(url, {
        waitUntil: 'networkidle2'
    });
    */

    return categoryData;
}


async function processCategoryData(page){

    var offset = 0;
    var file = `data/gambio/categoriesData.${offset}.json`;
    var categoriesData = jsonfile.readFileSync(file);
    var products = [];
    //console.log('categoriesData length: ', categoriesData.length);

    for(var i = 0; i<categoriesData.length; i++){
        if(i> 3) break;
        

        var categoryItem = categoriesData[i];
        var products = categoryItem.products;

        console.log('processCategoryData index: ', i, categoryItem.url);

        for(var productIndex = 0; productIndex < products.length; productIndex++){
            var product = products[productIndex];
            var productUrl = product.url;
            var productUrlHash = md5(productUrl);

            var data = await getProduct(page, productUrl);
            jsonfile.writeFileSync(`data/gambio/products/${productUrlHash}.json`, data);
            console.log('processProduct index: ', productIndex, productUrl);
            await sleep(2000);
        }
    }
}


async function mapProduct(page, productUrl){

    var productUrlHash = md5(productUrl);
    var productFile = `data/gambio/products/${productUrlHash}.json`;
    var productData = jsonfile.readFileSync(productFile);
    var images = productData.images.map(src => ({src: src}));
    var variants = [];  

    var product = {
        title: productData.title,
        body_html: productData.description,
        images: images,
        variants: variants,
    };

    if(productData.modifierGroupCount === 0){

        var price = productData.price.replace(' EUR', '').replace(',', '.');

        variants.push({
            price: price,
            sku: productData.modelNumber,
        });
    }
    else if(productData.modifierGroupCount === 1){
        variants = productData.variations.map(variation => {
            var price = variation.price.replace(' EUR', '').replace(',', '.');
            return {
                price: price,
                sku: variation.model,
                option1: variation.option1,
            }
        });

        var values = variants.map(variant => variant.option1);
        product.options = [{name: productData.modifierLabel, values: values}];
    }
    else {

    }

    product.variants = variants;

    return product;
}


async function createProduct(page, productItem){

    var createResponse = await shopifyInstance.post(`products.json`, {
        product: productItem
    });

    if(createResponse.status != 201){
        console.error('ERROR: createCategory createResponse status= ', createResponse.status, createResponse.data);
        return 0;
    }

    var product = createResponse.data.product;
    
    //console.log('createProduct createResponse id: ', product);
    return product;
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

    //await processCategoryData(page);
    
    /**/
    var productUrl = process.env.GAMBIO_EXAMPLE_URL;
    var productItem = await mapProduct(page, productUrl);
    var product = await createProduct(page, productItem);
    console.log('product: ', productItem);// JSON.stringify(product.schemaData)
    //product.id -> put in array, at the end: set category product_ids ? or after every product?

    /*
    var productUrl = process.env.GAMBIO_EXAMPLE_URL;
    var product = await getProduct(page, productUrl);
    console.log('product: ', product);// JSON.stringify(product.schemaData)
    */
    await browser.close();
    

   /*
    var categories = await processCategories(page);
    //console.log('categories: ', categories);
    //await saveEntityPart('categories', 0, categories);
    var fullCategoryData = await processCategoryProducts(page, categories);
    await saveEntityPart('categoriesData', 0, fullCategoryData);
    await browser.close();
    return;
    */
    

    /*
    var categoryUrl = process.env.GAMBIO_EXAMPLE_CATEGORY;
    var categoryData = await processCategoryPage(page, categoryUrl);
    console.log(categoryData);   
    await browser.close();
    return;
    */


    /*
    var productUrl = process.env.GAMBIO_EXAMPLE_URL;
    var product = await getProduct(page, productUrl);
    console.log('product: ', product);// JSON.stringify(product.schemaData)
    await browser.close();
    return;
    */


    /*
    var categoryUrl = process.env.GAMBIO_EXAMPLE_CATEGORY;
    var categoryData = await processCategoryPage(page, categoryUrl);
    var productDetails = categoryData.products;

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


    //.productlist: .current-price-container, a.product-url
    //var selector = '.productlist .current-price-container';
    //await processPage();
    

})();