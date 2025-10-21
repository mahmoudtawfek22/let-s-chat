import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const request = req.clone({
    withCredentials: true,
    setHeaders: {
      // Accept: 'application/json',
    },
  });
  return next(req);
};
