# Salvar arquivo

ApÃ³s o upload do arquivo na URL fornecida na rota GET /core/v2/file execute este metodo para obter o ID do arquivo<br />O Id do arquivo pode ser fornecido no envio de mensagens. <br /><br />O FileId pode ser reaproveitado, nÃ£o sendo necessÃ¡rio novos uploads para o mesmo arquivo.

# OpenAPI definition

```json
{
  "openapi": "3.0.1",
  "info": {
    "title": "Core",
    "description": "",
    "version": "1.0"
  },
  "servers": [
    {
      "url": "https://api.wts.chat/core",
      "description": "Production Server"
    }
  ],
  "paths": {
    "/v2/file": {
      "post": {
        "tags": [
          "Arquivos"
        ],
        "summary": "Salvar arquivo",
        "description": "ApÃ³s o upload do arquivo na URL fornecida na rota GET /core/v2/file execute este metodo para obter o ID do arquivo<br />O Id do arquivo pode ser fornecido no envio de mensagens. <br /><br />O FileId pode ser reaproveitado, nÃ£o sendo necessÃ¡rio novos uploads para o mesmo arquivo.",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PublicReqFileSaveV2DTO"
              }
            },
            "text/json": {
              "schema": {
                "$ref": "#/components/schemas/PublicReqFileSaveV2DTO"
              }
            },
            "application/*+json": {
              "schema": {
                "$ref": "#/components/schemas/PublicReqFileSaveV2DTO"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PublicFileV2DTO"
                }
              }
            }
          },
          "500": {
            "description": "Server Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/InternalException"
                }
              }
            }
          }
        },
        "security": [
          {
            "Bearer": []
          }
        ]
      }
    }
  },
  "components": {
    "schemas": {
      "InternalException": {
        "type": "object",
        "properties": {
          "error": {
            "type": "boolean"
          },
          "date": {
            "type": "string",
            "format": "date-time"
          },
          "key": {
            "type": "string",
            "nullable": true
          },
          "text": {
            "type": "string",
            "nullable": true
          },
          "details": {
            "nullable": true
          },
          "id": {
            "$ref": "#/components/schemas/InternalExceptionId"
          },
          "httpStatusCode": {
            "enum": [
              "Continue",
              "SwitchingProtocols",
              "Processing",
              "EarlyHints",
              "OK",
              "Created",
              "Accepted",
              "NonAuthoritativeInformation",
              "NoContent",
              "ResetContent",
              "PartialContent",
              "MultiStatus",
              "AlreadyReported",
              "IMUsed",
              "MultipleChoices",
              "Ambiguous",
              "MovedPermanently",
              "Moved",
              "Found",
              "Redirect",
              "SeeOther",
              "RedirectMethod",
              "NotModified",
              "UseProxy",
              "Unused",
              "TemporaryRedirect",
              "RedirectKeepVerb",
              "PermanentRedirect",
              "BadRequest",
              "Unauthorized",
              "PaymentRequired",
              "Forbidden",
              "NotFound",
              "MethodNotAllowed",
              "NotAcceptable",
              "ProxyAuthenticationRequired",
              "RequestTimeout",
              "Conflict",
              "Gone",
              "LengthRequired",
              "PreconditionFailed",
              "RequestEntityTooLarge",
              "RequestUriTooLong",
              "UnsupportedMediaType",
              "RequestedRangeNotSatisfiable",
              "ExpectationFailed",
              "MisdirectedRequest",
              "UnprocessableEntity",
              "Locked",
              "FailedDependency",
              "UpgradeRequired",
              "PreconditionRequired",
              "TooManyRequests",
              "RequestHeaderFieldsTooLarge",
              "UnavailableForLegalReasons",
              "InternalServerError",
              "NotImplemented",
              "BadGateway",
              "ServiceUnavailable",
              "GatewayTimeout",
              "HttpVersionNotSupported",
              "VariantAlsoNegotiates",
              "InsufficientStorage",
              "LoopDetected",
              "NotExtended",
              "NetworkAuthenticationRequired"
            ],
            "type": "string"
          },
          "version": {
            "type": "string",
            "nullable": true
          },
          "environment": {
            "type": "string",
            "nullable": true
          }
        },
        "additionalProperties": false
      },
      "InternalExceptionId": {
        "type": "object",
        "properties": {
          "value": {
            "type": "string",
            "nullable": true
          },
          "shortValue": {
            "type": "string",
            "nullable": true
          }
        },
        "additionalProperties": false
      },
      "PublicFileV2DTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "companyId": {
            "type": "string",
            "format": "uuid",
            "nullable": true
          },
          "userId": {
            "type": "string",
            "format": "uuid",
            "nullable": true
          },
          "name": {
            "type": "string",
            "nullable": true
          },
          "extension": {
            "type": "string",
            "nullable": true
          },
          "mimeType": {
            "type": "string",
            "nullable": true
          },
          "type": {
            "enum": [
              "UNDEFINED",
              "PDF",
              "EXCEL",
              "WORD",
              "IMAGE",
              "AUDIO",
              "VIDEO",
              "DOCUMENT"
            ],
            "type": "string"
          },
          "key": {
            "type": "string",
            "nullable": true
          },
          "size": {
            "type": "integer",
            "format": "int64"
          }
        },
        "additionalProperties": false
      },
      "PublicReqFileSaveV2DTO": {
        "required": [
          "tempFileId"
        ],
        "type": "object",
        "properties": {
          "tempFileId": {
            "type": "string",
            "description": "CÃ³digo do arquivo",
            "format": "uuid"
          }
        },
        "additionalProperties": false
      }
    },
    "securitySchemes": {
      "Bearer": {
        "type": "apiKey",
        "description": "Utilize o token permanente que foi gerado para sua conta na seÃ§Ã£o de integraÃ§Ãµes.<br>No campo abaixo, insira 'Bearer [token]' sem as aspas e sem os colchetes.<br>Exemplo: 'Bearer ***TOKEN_REMOVIDO***'.",
        "name": "Authorization",
        "in": "header"
      }
    }
  },
  "security": [
    {
      "Bearer": []
    }
  ],
  "x-readme": {
    "explorer-enabled": true,
    "proxy-enabled": true
  },
  "_id": {
    "buffer": {
      "0": 101,
      "1": 170,
      "2": 182,
      "3": 67,
      "4": 7,
      "5": 155,
      "6": 138,
      "7": 0,
      "8": 84,
      "9": 198,
      "10": 161,
      "11": 209
    }
  }
}
```