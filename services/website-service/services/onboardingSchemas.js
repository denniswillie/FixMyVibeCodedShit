const { z } = require("zod");

const positiveIntegerField = (fieldName, maxValue) =>
  z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, `${fieldName} must be a positive integer.`)
    .refine((value) => value <= maxValue, `${fieldName} is too large.`);

const onboardingConfigSchema = z.object({
  github: z.object({
    repoUrl: z.string().trim().url("Enter a valid GitHub repository URL.").max(2048),
    branch: z.string().trim().min(1, "Branch is required.").max(255),
    accessToken: z.string().trim().max(4096).default(""),
    connection: z
      .object({
        installationId: z.number().int().positive(),
        accountLogin: z.string().trim().max(255),
        targetType: z.string().trim().max(255),
        repositorySelection: z.string().trim().max(255),
        repoCount: z.number().int().min(0),
        connectedAt: z.string().trim().datetime().nullable()
      })
      .nullable()
      .optional()
  }),
  aws: z.object({
    accessKeyId: z.string().trim().min(1, "AWS access key id is required.").max(255),
    secretAccessKey: z.string().trim().min(1, "AWS secret access key is required.").max(4096),
    sessionToken: z.string().trim().max(8192).default(""),
    region: z.string().trim().min(1, "AWS region is required.").max(255),
    instanceId: z.string().trim().min(1, "EC2 instance id is required.").max(255),
    dockerService: z.string().trim().min(1, "Docker service is required.").max(255),
    logTail: positiveIntegerField("Log tail", 100000)
  }),
  schedule: z.object({
    everyMinutes: positiveIntegerField("Every minutes", 10080),
    timezone: z.string().trim().min(1, "Timezone is required.").max(255)
  })
});

function parseOnboardingConfig(payload) {
  return onboardingConfigSchema.parse(payload);
}

module.exports = {
  onboardingConfigSchema,
  parseOnboardingConfig
};
