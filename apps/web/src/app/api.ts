import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from './environment';
@Injectable({providedIn:'root'})
export class Api {
  private http=inject(HttpClient);
  event(){return this.http.get<any>(`${environment.api}/event`)}
  lots(){return this.http.get<any[]>(`${environment.api}/lots`)}
  register(data:FormData,key:string){return this.http.post<any>(`${environment.api}/registrations`,data,{headers:{'Idempotency-Key':key}})}
  login(body:any){return this.http.post(`${environment.api}/admin/login`,body,{withCredentials:true})}
  dashboard(){return this.http.get<any>(`${environment.api}/admin/dashboard`,{withCredentials:true})}
  registrations(){return this.http.get<any>(`${environment.api}/admin/registrations`,{withCredentials:true})}
  proof(id:string){return this.http.get<any>(`${environment.api}/admin/registrations/${id}/proof`,{withCredentials:true})}
}
