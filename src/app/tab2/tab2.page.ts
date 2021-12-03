import { AfterViewInit, Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment.prod';


import * as Mapboxgl from 'mapbox-gl';
import { FarmaciasService } from '../services/farmacias.service';
import { Farmacia } from '../interfaces/farmacia.interface';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit, AfterViewInit {

  mapa: any;
  LngLat: Mapboxgl.LngLat;
  farmacias: Farmacia[] = [];
  visibles = false;
  markers: Mapboxgl.Marker[] = [];
  estilo = 'primary';
  estiloMapa = '';
  constructor(private farmaciaService: FarmaciasService) {

  }

  ngOnInit() {
    // evita la carga con defectos del mapa
    setTimeout(() => this.cargarMapa(), 100);

    setTimeout(() =>
      this.cargarFarmacias(), 1000);

    setTimeout(() =>
      this.mapa.resize(), 1000);



  }

  ngAfterViewInit() {

  }


  cargarMapa() {
    const hoy = new Date();
    const hora = hoy.getHours();
    let estiloMapa;
    if (hora < 19 && hora > 7) {
      estiloMapa = 'mapbox://styles/mapbox/light-v10';
    } else {
      estiloMapa = 'mapbox://styles/mapbox/dark-v10';
    }
    // inicializa el mapa
    (Mapboxgl as any).accessToken = environment.mapboxKey;
    this.mapa = new Mapboxgl.Map({
      container: 'mapamapbox', // container id
      // style: 'mapbox://styles/mapbox/light-v10',
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
        if (this.farmacias.length > 0) {
          console.log('carga exitosa -> filas: ', this.farmacias.length);
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
      const farms: Farmacia[] = this.farmacias;
      farms.forEach(farmacia => {
        this.cargarFarmacia(farmacia);
      });
    } else {
      this.visibles = false;
      this.quitarFarmacias();
    }
    this.estilo = (!this.visibles ? 'primary' : 'danger');
  }

  // carga una farmacia en el mapa
  cargarFarmacia(farmacia: Farmacia) {
    const lng = farmacia.coords[1];
    const lat = farmacia.coords[0];
    const marker = new Mapboxgl.Marker({
      color: '#42d77d',
    })
      .setLngLat([lng, lat])
      .setPopup(new Mapboxgl.Popup({ closeOnClick: false })
        .setLngLat([lng, lat])
        .setHTML(`<p><strong>${farmacia.nombre}</strong>
                          <br>${farmacia.telefono}</p>`))
      .addTo(this.mapa);
    // carga array de marcadores.
    this.markers.push(marker);

  }

  quitarFarmacias() {
    this.markers.forEach(farmacia => {
      farmacia.remove();
    });
    this.markers = [];
    console.log('cantidad de elemntos en markers: ', this.markers.length);
  }



}
