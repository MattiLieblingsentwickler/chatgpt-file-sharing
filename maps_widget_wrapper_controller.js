import { Controller } from '@hotwired/stimulus';

export default class extends Controller {

    static values = {
        apiKey: String,
        placeDetailsUrl: String,
        exposeUrl: String
    }

    connect() {
        if (window.googleMapsInitialized) {
            if (!window.globals.mapsWidgetCopy) {
                this.element.innerHTML = '';
                this.createMapsElement();
                return;
            }
            let mapsElement = window.globals.mapsWidgetCopy;
            mapsElement = this.passMapsData(mapsElement);
            this.element.appendChild(mapsElement);
            return;
        }

        this._prepareApi(this.apiKeyValue).then(() => {
            this.createMapsElement();
        });

        document.addEventListener('turbo:before-cache', this.copyCurrentMap);

        this.initGlobals();
    }

    createMapsElement() {
        let mapsElement = document.createElement('div');
        mapsElement.setAttribute('id', 'maps-widget');
        mapsElement.setAttribute('data-controller', 'maps-widget');
        mapsElement.classList.add('d-none');
        mapsElement.classList.add('d-md-block');
        mapsElement = this.passMapsData(mapsElement);
        this.element.appendChild(mapsElement);
    }

    passMapsData(element) {
        element.setAttribute('data-maps-widget-place-details-url-value', this.placeDetailsUrlValue);
        element.setAttribute('data-maps-widget-expose-url-value', this.exposeUrlValue);
        element.setAttribute('data-action', 'marker-data-transfer:marker-data-updated@window->maps-widget#updateMarkers ' +
            'marker-data-transfer:marker-hover-state-changed@window->maps-widget#markerHoverStateChanged');
        return element;
    }

    initGlobals() {
        window.globals = {
            placeTargetChanged: true,
            mapsWidgetCopy: null,
            mapVisible: false,
            resetMap: false,
        }
    }

    async _prepareApi(apiKey) {
        function get(src) {
            return new Promise(function (resolve, reject) {
                const el = document.createElement('script');
                el.async = true;
                el.addEventListener(
                    'error',
                    function () {
                        reject(src);
                    },
                    false
                );
                el.src = src;
                (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(el);

                window.googleMapsInitialized = function () {
                    resolve(src);
                };
            });
        }

        const myPromises = await get(
            'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&region=DE&language=de&callback=googleMapsInitialized'
        );

        return await Promise.all(myPromises);
    }

    copyCurrentMap() {
        if (window.globals.resetMap) {
            window.globals.resetMap = false;
            return;
        }
        window.globals.mapsWidgetCopy = document.getElementById('maps-widget');
    }
}