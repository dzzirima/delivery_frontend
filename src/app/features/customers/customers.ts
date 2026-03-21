import { Component } from '@angular/core';
import { CustomerCardComponent, Customer } from './ui/customer-card/customer-card';

@Component({
  selector: 'app-customers',
  imports: [CustomerCardComponent],
  templateUrl: './customers.html',
})
export class Customers {
  customers: Customer[] = [
    { name: 'Sam Moyo',     email: 'sam.moyo@email.com',  orders: 14, joined: 'Jan 2026' },
    { name: 'Tanya Mhuru',  email: 'tanya@email.com',     orders: 9,  joined: 'Feb 2026' },
    { name: 'Chidi Obi',    email: 'chidi.obi@email.com', orders: 22, joined: 'Dec 2025' },
    { name: 'Grace Ncube',  email: 'grace@email.com',     orders: 5,  joined: 'Mar 2026' },
    { name: 'Lena Dube',    email: 'lena.d@email.com',    orders: 3,  joined: 'Mar 2026' },
    { name: 'Farai Mutasa', email: 'farai@email.com',     orders: 18, joined: 'Nov 2025' },
  ];
}
