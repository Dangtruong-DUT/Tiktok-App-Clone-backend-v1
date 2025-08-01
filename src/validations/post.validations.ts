import { checkSchema, ParamSchema } from 'express-validator'
import { isEmpty } from 'lodash'
import { ObjectId } from 'mongodb'
import { Audience, MediaType, PosterType } from '~/constants/enum'
import HTTP_STATUS from '~/constants/httpStatus'
import { POST_MESSAGES } from '~/constants/messages/post'
import { validate } from '~/middlewares/validation.middlewares'
import { ErrorWithStatus } from '~/models/Errors'
import tikTokPostService from '~/services/TiktokPost.service'
import usersServices from '~/services/users.service'
import { numberEnumToArray } from '~/utils/common'
import { limitSchema, pageSchema } from '~/validations/schemas/pagination.schema'

const validatePostId: ParamSchema = {
    notEmpty: {
        errorMessage: POST_MESSAGES.POST_ID_IS_REQUIRED
    },
    isString: {
        errorMessage: POST_MESSAGES.POST_ID_MUST_BE_STRING
    },
    custom: {
        options: async (value: string, { req }) => {
            if (!ObjectId.isValid(value)) {
                throw new ErrorWithStatus({
                    message: POST_MESSAGES.INVALID_POST_ID,
                    status: HTTP_STATUS.NOT_FOUND
                })
            }
            const user_id = req.decoded_authorization?.user_id
            const post = await tikTokPostService.getPostDetail({ post_id: value, user_id: user_id })
            if (!post) {
                throw new ErrorWithStatus({
                    message: POST_MESSAGES.POST_NOT_FOUND,
                    status: HTTP_STATUS.NOT_FOUND
                })
            }
            req.post = post

            return true
        }
    },
    trim: true
}

export const createTiktokPostValidator = validate(
    checkSchema(
        {
            type: {
                isIn: {
                    options: [numberEnumToArray(PosterType)],
                    errorMessage: POST_MESSAGES.INVALID_POST_TYPE
                }
            },
            audience: {
                isIn: {
                    options: [numberEnumToArray(Audience)],
                    errorMessage: POST_MESSAGES.INVALID_AUDIENCE_TYPE
                }
            },
            content: {
                isString: true,
                isLength: {
                    options: { max: 500 },
                    errorMessage: POST_MESSAGES.CONTENT_MAX_LENGTH
                },
                custom: {
                    options: (value: string, { req }) => {
                        const type = req.body.type
                        const medias = req.body.medias
                        const mentions = req.body.mentions

                        if (
                            !(typeof value === 'string' && value.trim()) &&
                            [PosterType.COMMENT, PosterType.QUOTE_POST].includes(type) &&
                            isEmpty(medias) &&
                            isEmpty(mentions)
                        ) {
                            throw new Error(POST_MESSAGES.CONTENT_REQUIRED)
                        }
                        return true
                    }
                },
                trim: true
            },
            parent_id: {
                trim: true,
                optional: true,
                notEmpty: {
                    errorMessage: POST_MESSAGES.INVALID_PARENT_ID
                },
                isString: {
                    errorMessage: POST_MESSAGES.INVALID_PARENT_ID
                },
                custom: {
                    options: (value: string, { req }) => {
                        const type = req.body.type
                        // If parent_id is provided different null, then type must be comment, reports, quotes
                        if (
                            !ObjectId.isValid(value) &&
                            [PosterType.COMMENT, PosterType.RE_POST, PosterType.QUOTE_POST].includes(type)
                        ) {
                            throw new Error(POST_MESSAGES.INVALID_PARENT_ID)
                        }

                        // If parent_id is provided and type is posts, then it must be null
                        if (value != null && type === PosterType.POST) {
                            throw new Error(POST_MESSAGES.PARENT_ID_MUST_BE_NULL)
                        }
                        return true
                    }
                }
            },
            hashtags: {
                isArray: true,
                optional: true,
                errorMessage: POST_MESSAGES.HASHTAGS_MUST_BE_ARRAY,
                custom: {
                    options: (value: string[]) => {
                        if (!value.every((item) => typeof item === 'string')) {
                            throw new Error(POST_MESSAGES.HASHTAG_MUST_BE_STRING)
                        }
                        return true
                    }
                }
            },
            mentions: {
                isArray: true,
                errorMessage: POST_MESSAGES.MENTIONS_MUST_BE_ARRAY,
                custom: {
                    options: async (value: string[]) => {
                        const results = await Promise.all(
                            value.map(async (item) => {
                                const user = await usersServices.getUserById(item)
                                return user !== null
                            })
                        )
                        if (!results.every(Boolean)) {
                            throw new Error(POST_MESSAGES.INVALID_MENTION)
                        }
                        return true
                    }
                }
            },
            medias: {
                isArray: true,
                errorMessage: POST_MESSAGES.MEDIA_FILES_MUST_BE_ARRAY,
                custom: {
                    options: (value, { req }) => {
                        if (
                            (req.body.type === PosterType.POST || req.body.type === PosterType.QUOTE_POST) &&
                            isEmpty(value)
                        ) {
                            throw new Error(POST_MESSAGES.MEDIA_FILES_REQUIRED)
                        }
                        if (
                            !value.every((item: any) => {
                                return typeof item.url === 'string' && Object.values(MediaType).includes(item.type)
                            })
                        ) {
                            throw new Error(POST_MESSAGES.INVALID_MEDIA_TYPE)
                        }
                        return true
                    }
                }
            }
        },
        ['body']
    )
)

export const getPostDetailValidator = validate(
    checkSchema(
        {
            post_id: validatePostId
        },
        ['params']
    )
)

export const bookMarksTiktokPostValidator = validate(checkSchema({ post_id: validatePostId }, ['body']))

export const likeTiktokPostValidator = validate(checkSchema({ post_id: validatePostId }, ['body']))

export const unBookMarksTiktokValidator = validate(
    checkSchema(
        {
            post_id: validatePostId
        },
        ['params']
    )
)

export const unLikeTiktokPostValidator = validate(
    checkSchema(
        {
            post_id: validatePostId
        },
        ['params']
    )
)

export const getChildrenPostsValidator = validate(
    checkSchema(
        {
            post_id: validatePostId,
            page: pageSchema,
            limit: limitSchema,
            type: {
                isIn: {
                    options: [numberEnumToArray(PosterType)],
                    errorMessage: POST_MESSAGES.INVALID_POST_TYPE
                }
            }
        },
        ['params', 'query']
    )
)
