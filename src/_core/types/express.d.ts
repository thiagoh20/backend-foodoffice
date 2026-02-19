import "express";

declare module "express-serve-static-core" {
  interface Request {
    query: Record<string, string | string[] | undefined>;
    protocol: string;
    headers: {
      [key: string]: string | string[] | undefined;
      cookie?: string;
      "x-forwarded-proto"?: string | string[];
    };
  }

  interface Response {
    cookie(
      name: string,
      value: string,
      options?: {
        httpOnly?: boolean;
        path?: string;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
        domain?: string;
        maxAge?: number;
        expires?: Date;
      }
    ): this;
    clearCookie(
      name: string,
      options?: {
        httpOnly?: boolean;
        path?: string;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
        domain?: string;
      }
    ): this;
    status(code: number): this;
    json(body: any): this;
    redirect(url: string): this;
    redirect(status: number, url: string): this;
  }
}

