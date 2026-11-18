import type { AuthService } from "@workspace/auth";
import type { AccessControlService, AttendanceService, CommissionRuleService, ContentService, Db, EnrollmentService, ExamService, FeeExceptionService, GuardianService, NoticeService, PaymentService, ReportService, PayoutService, PromotionService, StudentService } from "@workspace/domain";
import { Hono } from "hono";
import { createAdminRoutes } from "./admin";
import { createAuthRoutes } from "./auth-routes";
import { createContentRoutes } from "./content-routes";
import { createExamRoutes } from "./exam-routes";
import { onError } from "./http";
import { requireTrustedOrigin } from "./origin";
import { createPortalRoutes } from "./portal";
import type { SessionConfig } from "./session";

export interface ApiConfig extends Partial<SessionConfig> {
  /** Origins of our own web apps (CSRF guard). At least one. */
  trustedOrigins: string[];
}

export interface ApiDeps {
  db: Db;
  auth: AuthService;
  acl: AccessControlService;
  payments: PaymentService;
  content: ContentService;
  notices: NoticeService;
  reports: ReportService;
  guardians: GuardianService;
  commissionRules: CommissionRuleService;
  students: StudentService;
  enrollment: EnrollmentService;
  attendance: AttendanceService;
  exams: ExamService;
  feeExceptions: FeeExceptionService;
  promotion: PromotionService;
  payouts: PayoutService;
  config: ApiConfig;
}

/** The whole API: /auth, /admin, /student and /parent. Cookie sessions, a CSRF origin guard on every write, JSON errors. */
export function createApi(deps: ApiDeps) {
  const session: SessionConfig = { cookieName: deps.config.cookieName ?? "sms_session", secureCookie: deps.config.secureCookie ?? true, trustProxy: deps.config.trustProxy ?? false };
  const app = new Hono();
  app.onError(onError);
  app.use("*", requireTrustedOrigin(deps.config.trustedOrigins));
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/auth", createAuthRoutes(deps.auth, session));
  app.route("/admin", createAdminRoutes({ ...deps, session }));
  app.route("/lecturer/content", createContentRoutes({ db: deps.db, auth: deps.auth, content: deps.content, session }, "lecturer"));
  app.route("/lecturer", createExamRoutes({ db: deps.db, auth: deps.auth, exams: deps.exams, session }, "lecturer"));
  const portals = createPortalRoutes({ ...deps, session });
  app.route("/student", portals.student);
  app.route("/parent", portals.parent);
  app.route("/lecturer/payouts", portals.lecturerPayouts);
  return app;
}
