import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { EMPTY, catchError, map } from 'rxjs';
import { GigService } from '../services/gig.service';
import { Gig } from '../models/gig.model';

export const gigDashboardResolver: ResolveFn<Gig> = route => {
  const service = inject(GigService);
  const router = inject(Router);
  const id = route.paramMap.get('id')!;

  return service.getById(id).pipe(
    map(res => res.data!),
    catchError(() => {
      router.navigate(['/app/applications']);
      return EMPTY;
    }),
  );
};
