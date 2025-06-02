export type McpAgentPropsModel = {
  userId: string;
  name: string;
  email: string;
  accessToken: string;
  clientId: string;
};

export type McpAgentToolParamsModel = {
  props: McpAgentPropsModel;
  env: Env;
};
