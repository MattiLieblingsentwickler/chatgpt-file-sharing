
const paramsObjectDefault = {
    "mapBounds": {
        "west": '',
        "east": '',
        "south": '',
        "north": ''
    },
    "placeSelection": {
        "placeId": -1,
    },
    "sort": 0,
    "filter": {
        "tradingType": 0,
        "priceMin": '',
        "priceMax": ''
    },
    "page": 0
};

export function setExploreUrlParam(key, value, pathPrefix = '') {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);

    let paramsObject = paramsObjectDefault;

    if (searchParams.has('p')) {
        const paramsValue = decodeURIComponent(searchParams.get('p'));
        paramsObject = JSON.parse(paramsValue);
    }

    paramsObject[key] = value;
    searchParams.set('p', encodeURIComponent(JSON.stringify(paramsObject)));

    if (pathPrefix !== '')
        url.pathname = pathPrefix;
    url.search = searchParams.toString();
    return url.toString();
}

export function getExploreUrlParam(key) {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);
    if (searchParams.has('p')) {
        const paramsValue = decodeURIComponent(searchParams.get('p'));
        let paramsObject = JSON.parse(paramsValue);
        return paramsObject[key];
    }
    return paramsObjectDefault[key];
}

export function removeExploreUrlParam(key) {
    return setExploreUrlParam(key, paramsObjectDefault[key]);
}