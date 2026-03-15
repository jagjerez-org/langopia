import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class AcademyScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Academy is set by either JwtStrategy (via user's membership) or ApiKeyGuard
    // This interceptor can be extended to inject academy context into services
    if (request.academy) {
      request.academyId = request.academy.id;
    }

    return next.handle();
  }
}
