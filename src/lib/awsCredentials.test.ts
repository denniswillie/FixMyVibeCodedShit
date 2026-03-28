import { parseAwsCredentialsFile } from "@/lib/awsCredentials";

describe("awsCredentials", () => {
  it("parses a shared AWS credentials file", () => {
    expect(
      parseAwsCredentialsFile(`
[default]
aws_access_key_id = AKIADEMO123
aws_secret_access_key = secret-demo
aws_session_token = token-demo
      `)
    ).toEqual({
      accessKeyId: "AKIADEMO123",
      secretAccessKey: "secret-demo",
      sessionToken: "token-demo",
    });
  });

  it("parses an IAM csv export", () => {
    expect(
      parseAwsCredentialsFile(`
"User name","Access key ID","Secret access key"
"vibefix-demo","AKIACSV456","csv-secret"
      `)
    ).toEqual({
      accessKeyId: "AKIACSV456",
      secretAccessKey: "csv-secret",
      sessionToken: "",
    });
  });

  it("rejects unsupported files", () => {
    expect(() => parseAwsCredentialsFile("hello world")).toThrow(/could not parse/i);
  });
});
