import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { Api } from './api';

@Component({
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent {
  event$ = inject(Api).event();
}
