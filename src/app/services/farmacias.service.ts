import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FarmaciaGeojson, TurnoProgramadoLocalidad, TurnosFarmaciaListado } from './../interfaces/farmacia.interface';


@Injectable({
  providedIn: 'root'
})
export class FarmaciasService {

  constructor(private http: HttpClient) { }

  getFarmacias() {
    return this.http.get<FarmaciaGeojson[]>('https://farmacias-7d813.firebaseio.com/farmacia2/features.json');
  }

  getTurnosEsperanza() {
    return this.http.get<TurnosFarmaciaListado>('assets/data/turnos-esperanza.json');
  }

  getTurnosColegio() {
    return this.http.get<TurnoProgramadoLocalidad[]>('assets/data/turnos-colegio-julio-2026.json');
  }
}
