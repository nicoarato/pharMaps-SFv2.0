import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment.prod';


import * as Mapboxgl from 'mapbox-gl';
import { FarmaciasService } from '../services/farmacias.service';
import { FarmaciaGeojson } from './../interfaces/farmacia.interface';
// import { Farmacia } from '../interfaces/farmacia.interface';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit {

  mapa: any;
  LngLat: Mapboxgl.LngLat;
  farmacias: FarmaciaGeojson[] = [];
  farmaciasFiltradas: FarmaciaGeojson[] = [];
  terminoBusqueda = '';
  visibles = false;
  markers: Mapboxgl.Marker[] = [];
  estilo = 'primary';
  estiloMapa = '';
  constructor(private farmaciaService: FarmaciasService) {}

  ngOnInit() {
    // evita la carga con defectos del mapa
    setTimeout(() => this.cargarMapa(), 100);

    setTimeout(() =>
      this.cargarFarmacias(), 1000);

    setTimeout(() =>
      this.mapa.resize(), 1000);
  }


  cargarMapa() {
    const hoy = new Date();
    const hora = hoy.getHours();
    let estiloMapa: string;
    if (hora < 19 && hora > 7) {
      estiloMapa = 'mapbox://styles/mapbox/light-v10';
    } else {
      estiloMapa = 'mapbox://styles/mapbox/dark-v10';
    }
    // inicializa el mapa
    (Mapboxgl as any).accessToken = environment.mapboxKey;
    this.mapa = new Mapboxgl.Map({
      container: 'mapamapbox', // container id
      style: estiloMapa,
      center: [-60.707367, -31.6251114], // starting position lng, lat
      zoom: 13, // starting zoom
      pitch: 15
    });

    this.mapa.addControl(new Mapboxgl.NavigationControl());
    this.mapa.addControl(new Mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true
    }));

    this.mapa.on('load', () => {
      this.mapa.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#aaa',

          // use an 'interpolate' expression to add a smooth transition effect to the
          // buildings as the user zooms in
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            15,
            0,
            15.05,
            ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      });
    })
  }


  // carga el pedido por http
  cargarFarmacias(event?) {
    this.farmaciaService.getFarmacias()
      .subscribe(res => {
        if (event) {
          event.target.complete();
        }
        this.farmacias = res;
        this.buscarFarmacias();
        if (this.farmacias.length > 0) {
          console.log('carga exitosa');
          return true;
        } else {
          console.log('problemas para cargar farmacias');
          return false;
        }
      });
  }

  // muestra todas las farmacias cargadas
  mostrarFarmacias() {
    if (!this.visibles) {
      this.visibles = true;
      this.quitarFarmacias();
      const farms: FarmaciaGeojson[] = this.farmacias;
      farms.forEach(farmacia => {
        this.cargarFarmacia(farmacia);
      });
    } else {
      this.visibles = false;
      this.quitarFarmacias();
    }
    this.estilo = (!this.visibles ? 'primary' : 'danger');
  }

  buscarFarmacias(valor?) {
    const valorBusqueda = typeof valor === 'string'
      ? valor
      : valor && valor.detail && typeof valor.detail.value === 'string'
        ? valor.detail.value
        : valor && valor.target && typeof valor.target.value === 'string'
          ? valor.target.value
          : this.terminoBusqueda;

    this.terminoBusqueda = valorBusqueda || '';
    const busqueda = this.normalizarTexto(this.terminoBusqueda);

    if (!busqueda) {
      this.farmaciasFiltradas = [];
      return;
    }

    this.farmaciasFiltradas = this.farmacias
      .filter(farmacia => this.farmaciaCoincide(farmacia, busqueda))
      .slice(0, 8);
  }

  buscarFarmaciasPorClick() {
    this.buscarFarmacias(this.terminoBusqueda);
  }

  seleccionarFarmacia(farmacia: FarmaciaGeojson) {
    if (!farmacia) {
      return;
    }

    const { geometry: { coordinates } } = farmacia;
    const lng = coordinates[0];
    const lat = coordinates[1];
    const marker = this.buscarMarker(farmacia) || this.cargarFarmacia(farmacia);

    this.mapa.flyTo({
      center: [lng, lat],
      zoom: 16,
      essential: true
    });

    marker.getPopup().addTo(this.mapa);
    this.terminoBusqueda = farmacia.properties.name;
    this.farmaciasFiltradas = [];
  }

  limpiarBusqueda() {
    this.terminoBusqueda = '';
    this.farmaciasFiltradas = [];
  }

  // carga una farmacia en el mapa
  cargarFarmacia(farmacia: FarmaciaGeojson) {
    if(!farmacia) return;
    const { geometry: { coordinates }, properties: {name, phone, address} } = farmacia;
    const lng = coordinates[0];
    const lat = coordinates[1];
    const el = document.createElement('div');
    el.className = 'marker';
    const marker = new Mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(new Mapboxgl.Popup({ closeOnClick: false })
        .setLngLat([lng, lat])
        .setHTML(`<p><strong>${name}</strong>
                          <br>${phone}
                          <br>${address}</p>
                          `))
      .addTo(this.mapa);
    // carga array de marcadores.
    this.markers.push(marker);
    return marker;

  }

  quitarFarmacias() {
    this.markers.forEach(farmacia => {
      farmacia.remove();
    });
    this.markers = [];
  }

  private farmaciaCoincide(farmacia: FarmaciaGeojson, busqueda: string) {
    const properties = farmacia && farmacia.properties ? farmacia.properties : null;

    if (!properties) {
      return false;
    }

    const texto = this.normalizarTexto([
      properties.name,
      properties.address,
      properties.localidad,
      properties.phone,
      properties.farma_id
    ].join(' '));

    return texto.includes(busqueda);
  }

  private buscarMarker(farmacia: FarmaciaGeojson) {
    const { geometry: { coordinates } } = farmacia;
    const lng = coordinates[0];
    const lat = coordinates[1];

    return this.markers.find(marker => {
      const markerLngLat = marker.getLngLat();

      return markerLngLat.lng === lng && markerLngLat.lat === lat;
    });
  }

  private normalizarTexto(texto: string) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }


}
