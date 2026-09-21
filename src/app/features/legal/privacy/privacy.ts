import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_COMPANY, LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from '../legal-layout';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.html',
})
export class Privacy {
  readonly effective = LEGAL_EFFECTIVE_DATE;
  readonly email = LEGAL_CONTACT_EMAIL;
  readonly company = LEGAL_COMPANY;
}
