import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from './api';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
})
export class RegistrationComponent {
  api = inject(Api);
  fb = inject(FormBuilder);
  lots: any[] = [];
  event: any;
  selected: any;
  proof?: File;
  sending = false;
  error = '';
  success: any;
  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    graduatedFromSchool: ['', Validators.required],
    graduationYear: [''],
  });
  constructor() {
    this.api.lots().subscribe((x) => {
      this.lots = x;
      this.selected = x.find((lot) => lot.isCurrent);
    });
    this.api.event().subscribe((x) => (this.event = x));
    this.form.get('graduatedFromSchool')!.valueChanges.subscribe((value) => {
      const year = this.form.get('graduationYear')!;
      value === 'true'
        ? year.setValidators([Validators.required, Validators.min(1900)])
        : year.clearValidators();
      year.updateValueAndValidity();
    });
  }
  select(lot: any) {
    this.selected = lot;
    this.error = '';
  }
  file(event: Event) {
    this.proof = (event.target as HTMLInputElement).files?.[0];
  }
  maskPhone() {
    let value = this.form.value.phone!.replace(/\D/g, '').slice(0, 11);
    if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    else if (value.length > 2) value = value.replace(/(\d{2})(.*)/, '($1) $2');
    this.form.patchValue({ phone: value }, { emitEvent: false });
  }
  copy(value?: string) {
    if (value) navigator.clipboard.writeText(value);
    alert('Chave PIX copiada!');
  }
  submit() {
    if (this.form.invalid || !this.proof) {
      this.error = 'Preencha todos os campos obrigatórios e anexe o comprovante.';
      return;
    }
    this.sending = true;
    this.error = '';
    const data = new FormData();
    Object.entries(this.form.value).forEach(([key, value]) => data.append(key, value || ''));
    data.append('lotId', this.selected.id);
    data.append('proof', this.proof);
    this.api.register(data, crypto.randomUUID()).subscribe({
      next: (result) => {
        this.success = result;
        this.sending = false;
      },
      error: (response) => {
        this.error =
          response.error?.message || 'Não foi possível enviar o comprovante. Tente novamente.';
        this.sending = false;
      },
    });
  }
}
