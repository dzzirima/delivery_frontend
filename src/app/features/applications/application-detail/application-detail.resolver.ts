import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { EMPTY, catchError, map } from 'rxjs';
import { ApplicationService } from '../services/application.service';
import { ApplicationDetails } from '../models/application.model';

export const applicationDetailResolver: ResolveFn<ApplicationDetails> = route => {
  const service = inject(ApplicationService);
  const router = inject(Router);
  const id = route.paramMap.get('id')!;

  return service.getDetails(id).pipe(
    map(res => res.data),
    catchError(() => {
      router.navigate(['/app/applications']);
      return EMPTY;
    }),
  );
};
