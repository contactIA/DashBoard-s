Listar

# Listar

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
    "/v1/custom-field": {
      "get": {
        "tags": [
          "Campos"
        ],
        "summary": "Listar",
        "parameters": [
          {
            "name": "EntityType",
            "in": "query",
            "description": "Tipo de entidade do campo personalizado.",
            "schema": {
              "enum": [
                "CONTACT",
                "PANEL"
              ],
              "type": "string",
              "default": "CONTACT"
            }
          },
          {
            "name": "NestedList",
            "in": "query",
            "description": "Determina a estrutura da lista retornada. Se verdadeiro, os campos serÃ£o retornados de forma aninhada, isto Ã©, estruturado em grupos.",
            "schema": {
              "type": "boolean",
              "default": false
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/PublicCustomFieldDTO"
                  }
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
      "PublicCustomFieldDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "parentId": {
            "type": "string",
            "format": "uuid",
            "nullable": true
          },
          "type": {
            "enum": [
              "GROUP",
              "STRING",
              "TEXT",
              "INTEGER",
              "FLOAT",
              "SINGLESELECT",
              "MULTISELECT",
              "DATE",
              "TIME",
              "DATETIME",
              "BOOLEAN"
            ],
            "type": "string"
          },
          "entityType": {
            "enum": [
              "CONTACT",
              "PANEL"
            ],
            "type": "string"
          },
          "scopeId": {
            "type": "string",
            "format": "uuid",
            "nullable": true
          },
          "companyId": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string",
            "nullable": true
          },
          "key": {
            "type": "string",
            "nullable": true
          },
          "position": {
            "type": "integer",
            "format": "int32"
          },
          "required": {
            "type": "boolean"
          },
          "visible": {
            "type": "boolean"
          },
          "isValueRange": {
            "type": "boolean"
          },
          "options": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/PublicCustomFieldOptionDTO"
            },
            "nullable": true
          },
          "children": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/PublicCustomFieldDTO"
            },
            "nullable": true
          }
        },
        "additionalProperties": false
      },
      "PublicCustomFieldOptionDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string",
            "nullable": true
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