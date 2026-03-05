import { ApiError } from "./errors";
import {
  AuthResource,
  AcademiesResource,
  DashboardResource,
  UserProfileResource,
  StripeResource,
  ClassesResource,
  StudentsResource,
  TeachersResource,
  UsageResource,
  ExercisesResource,
  MediaResource,
  LessonsResource,
  LearningPathsResource,
  RoomsResource,
  RoomInternalResource,
  MeResource,
} from "./resources";

export type AuthMode = "jwt" | "apikey" | "none";

export interface LangopiaClientConfig {
  baseUrl: string;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string }) => void;
}

export interface RequestOptions {
  method: string;
  path: string;
  auth: AuthMode;
  body?: unknown;
  query?: Record<string, unknown>;
  formData?: FormData;
}

export class LangopiaClient {
  private config: LangopiaClientConfig;
  private refreshPromise: Promise<void> | null = null;

  // Resource namespaces
  readonly auth: AuthResource;
  readonly academies: AcademiesResource;
  readonly dashboard: DashboardResource;
  readonly userProfile: UserProfileResource;
  readonly stripe: StripeResource;
  readonly classes: ClassesResource;
  readonly students: StudentsResource;
  readonly teachers: TeachersResource;
  readonly usage: UsageResource;
  readonly exercises: ExercisesResource;
  readonly media: MediaResource;
  readonly lessons: LessonsResource;
  readonly learningPaths: LearningPathsResource;
  readonly rooms: RoomsResource;
  readonly roomInternal: RoomInternalResource;
  readonly me: MeResource;

  constructor(config: LangopiaClientConfig) {
    this.config = config;

    this.auth = new AuthResource(this);
    this.academies = new AcademiesResource(this);
    this.dashboard = new DashboardResource(this);
    this.userProfile = new UserProfileResource(this);
    this.stripe = new StripeResource(this);
    this.classes = new ClassesResource(this);
    this.students = new StudentsResource(this);
    this.teachers = new TeachersResource(this);
    this.usage = new UsageResource(this);
    this.exercises = new ExercisesResource(this);
    this.media = new MediaResource(this);
    this.lessons = new LessonsResource(this);
    this.learningPaths = new LearningPathsResource(this);
    this.rooms = new RoomsResource(this);
    this.roomInternal = new RoomInternalResource(this);
    this.me = new MeResource(this);
  }

  /** Update tokens after login/refresh */
  setTokens(accessToken: string, refreshToken?: string): void {
    this.config.accessToken = accessToken;
    if (refreshToken) this.config.refreshToken = refreshToken;
  }

  /** Update API key */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /** Core request method used by all resources */
  async request<T>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers: Record<string, string> = {};

    // Auth header
    if (options.auth === "jwt" && this.config.accessToken) {
      headers["Authorization"] = `Bearer ${this.config.accessToken}`;
    } else if (options.auth === "apikey" && this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    // Body
    let bodyInit: BodyInit | undefined;
    if (options.formData) {
      bodyInit = options.formData;
      // Let browser set Content-Type with boundary
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      bodyInit = JSON.stringify(options.body);
    }

    const res = await fetch(url, {
      method: options.method,
      headers,
      body: bodyInit,
    });

    // Auto-refresh on 401 for JWT requests
    if (res.status === 401 && options.auth === "jwt" && this.config.refreshToken) {
      await this.refreshTokens();
      // Retry with new token
      headers["Authorization"] = `Bearer ${this.config.accessToken}`;
      const retryRes = await fetch(url, {
        method: options.method,
        headers,
        body: bodyInit,
      });
      return this.handleResponse<T>(retryRes);
    }

    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 204) {
      return undefined as T;
    }

    let body: unknown;
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    if (!res.ok) {
      throw new ApiError(res.status, body);
    }

    return body as T;
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = new URL(`${base}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async refreshTokens(): Promise<void> {
    // Deduplicate concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await this.auth.refresh({
          refreshToken: this.config.refreshToken!,
        });
        this.config.accessToken = res.accessToken;
        this.config.refreshToken = res.refreshToken;
        this.config.onTokenRefresh?.({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}
