import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_CONFIG, ApiConfig, buildApiUrl } from '../../../core/api/api.config';
import { mapHttpError } from '../../../core/api/http-error.mapper';
import { AuthenticationResultResourceDto } from './iam.dto';
import {
  AssignRoleInput,
  AuthenticationInput,
  AuthenticationSessionRecord,
  IamGateway,
  RoleAssignmentRecord,
} from './iam.gateway';
import { mapAuthenticationResultResourceDto } from './iam.mapper';

@Injectable()
export class HttpIamGateway implements IamGateway {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_CONFIG) private readonly apiConfig: ApiConfig,
  ) {}

  authenticate(input: AuthenticationInput): Observable<AuthenticationSessionRecord> {
    return this.http
      .post<AuthenticationResultResourceDto>(
        buildApiUrl(this.apiConfig, '/api/v1/authentication/sign-in'),
        { username: input.username, password: input.password },
      )
      .pipe(
        map(mapAuthenticationResultResourceDto),
        catchError((error) => throwError(() => mapHttpError(error))),
      );
  }

  assignRole(_identityId: string, _input: AssignRoleInput): Observable<RoleAssignmentRecord> {
    return throwError(() => ({
      status: 501,
      code: 'UNSUPPORTED_OPERATION',
      message: 'The backend does not expose role-assignment operations.',
      fieldErrors: [],
    }));
  }
}
